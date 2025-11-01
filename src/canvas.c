#include "canvas.h"
#include <math.h>

struct _CheatCanvas {
    GtkDrawingArea parent_instance;
    Document *doc;               // not owned
    double zoom;                 // screen pixels per point
    gboolean crop_mode;

    ImageItem *selected;

    // drag state
    gboolean dragging;
    enum { DRAG_NONE, DRAG_MOVE, DRAG_RESIZE, DRAG_CROP } drag_kind;
    int drag_handle; // which corner/edge for resize/crop
    double drag_start_px, drag_start_py; // device px
    // original values
    double orig_x, orig_y, orig_w, orig_h;
    int orig_cx, orig_cy, orig_cw, orig_ch;
};

G_DEFINE_TYPE(CheatCanvas, cheat_canvas, GTK_TYPE_DRAWING_AREA)

static void cheat_canvas_queue_redraw(CheatCanvas *self) { gtk_widget_queue_draw(GTK_WIDGET(self)); }

static void draw_page_and_items(CheatCanvas *self, cairo_t *cr, int width, int height);
static gboolean on_draw(GtkWidget *w, cairo_t *cr, gpointer user_data);
static gboolean on_button_press(GtkWidget *w, GdkEventButton *ev, gpointer user_data);
static gboolean on_button_release(GtkWidget *w, GdkEventButton *ev, gpointer user_data);
static gboolean on_motion(GtkWidget *w, GdkEventMotion *ev, gpointer user_data);
static gboolean on_scroll(GtkWidget *w, GdkEventScroll *ev, gpointer user_data);

static void cheat_canvas_init(CheatCanvas *self) {
    self->doc = NULL;
    self->zoom = 1.25; // default zoom
    self->crop_mode = FALSE;
    self->selected = NULL;
    self->dragging = FALSE;
    gtk_widget_add_events(GTK_WIDGET(self), GDK_BUTTON_PRESS_MASK | GDK_BUTTON_RELEASE_MASK |
                                              GDK_POINTER_MOTION_MASK | GDK_SCROLL_MASK);
    g_signal_connect(self, "draw", G_CALLBACK(on_draw), NULL);
    g_signal_connect(self, "button-press-event", G_CALLBACK(on_button_press), NULL);
    g_signal_connect(self, "button-release-event", G_CALLBACK(on_button_release), NULL);
    g_signal_connect(self, "motion-notify-event", G_CALLBACK(on_motion), NULL);
    g_signal_connect(self, "scroll-event", G_CALLBACK(on_scroll), NULL);
}

static void cheat_canvas_dispose(GObject *obj) {
    CheatCanvas *self = CHEAT_CANVAS(obj);
    self->doc = NULL;
    self->selected = NULL;
    G_OBJECT_CLASS(cheat_canvas_parent_class)->dispose(obj);
}

static void cheat_canvas_class_init(CheatCanvasClass *klass) {
    GObjectClass *gobj_class = G_OBJECT_CLASS(klass);
    gobj_class->dispose = cheat_canvas_dispose;
}

GtkWidget *cheat_canvas_new(Document *doc) {
    CheatCanvas *self = g_object_new(CHEAT_TYPE_CANVAS, NULL);
    cheat_canvas_set_document(self, doc);
    return GTK_WIDGET(self);
}

void cheat_canvas_set_document(CheatCanvas *self, Document *doc) {
    g_return_if_fail(CHEAT_IS_CANVAS(self));
    self->doc = doc;
    self->selected = NULL;
    cheat_canvas_queue_redraw(self);
}

Document *cheat_canvas_get_document(CheatCanvas *self) { return self->doc; }

void cheat_canvas_zoom_in(CheatCanvas *self) { self->zoom *= 1.1; cheat_canvas_queue_redraw(self); }
void cheat_canvas_zoom_out(CheatCanvas *self) { self->zoom /= 1.1; if (self->zoom < 0.2) self->zoom = 0.2; cheat_canvas_queue_redraw(self); }
void cheat_canvas_zoom_reset(CheatCanvas *self) { self->zoom = 1.25; cheat_canvas_queue_redraw(self); }

void cheat_canvas_toggle_crop_mode(CheatCanvas *self) { self->crop_mode = !self->crop_mode; cheat_canvas_queue_redraw(self); }

static void canvas_add_item_centered(CheatCanvas *self, ImageItem *it) {
    Page *p = document_current_page(self->doc);
    page_add_item(p, it);
    self->selected = it;
    page_bring_to_front(p, it);
    cheat_canvas_queue_redraw(self);
}

void cheat_canvas_add_pixbuf(CheatCanvas *self, GdkPixbuf *pixbuf) {
    if (!self->doc || !pixbuf) return;
    ImageItem *it = image_item_new(pixbuf);
    canvas_add_item_centered(self, it);
}

void cheat_canvas_delete_selection(CheatCanvas *self) {
    if (!self->doc || !self->selected) return;
    Page *p = document_current_page(self->doc);
    page_remove_item(p, self->selected);
    self->selected = NULL;
    cheat_canvas_queue_redraw(self);
}

void cheat_canvas_next_page(CheatCanvas *self) {
    if (!self->doc) return;
    if (self->doc->current_page + 1 < (int)self->doc->pages->len) {
        self->doc->current_page++;
    } else {
        document_add_page(self->doc);
    }
    self->selected = NULL;
    cheat_canvas_queue_redraw(self);
}

void cheat_canvas_prev_page(CheatCanvas *self) {
    if (!self->doc) return;
    if (self->doc->current_page > 0) self->doc->current_page--;
    self->selected = NULL;
    cheat_canvas_queue_redraw(self);
}

// Geometry helpers

static void px_to_page(CheatCanvas *self, double sx, double sy, double *out_px, double *out_py, int alloc_w, int alloc_h) {
    double w = A4_WIDTH_PT * self->zoom;
    double h = A4_HEIGHT_PT * self->zoom;
    double offx = (alloc_w - w) / 2.0;
    double offy = (alloc_h - h) / 2.0;
    if (out_px) *out_px = (sx - offx) / self->zoom;
    if (out_py) *out_py = (sy - offy) / self->zoom;
}

static gboolean point_in_item(ImageItem *it, double px, double py) {
    return (px >= it->x && py >= it->y && px <= it->x + it->width && py <= it->y + it->height);
}

static ImageItem *hit_test(CheatCanvas *self, double page_x, double page_y) {
    Page *p = document_current_page(self->doc);
    // Iterate from front (tail) to back
    for (GList *l = g_list_last(p->items); l; l = l->prev) {
        ImageItem *it = (ImageItem*)l->data;
        if (point_in_item(it, page_x, page_y)) return it;
    }
    return NULL;
}

static void draw_checker(cairo_t *cr, double x, double y, double w, double h) {
    cairo_save(cr);
    cairo_rectangle(cr, x, y, w, h);
    cairo_clip(cr);
    const double s = 12.0;
    for (double yy = y; yy < y + h + s; yy += s) {
        for (double xx = x; xx < x + w + s; xx += s) {
            int i = ((int)((xx - x)/s) + (int)((yy - y)/s)) & 1;
            cairo_set_source_rgb(cr, i ? 0.92 : 0.82, i ? 0.92 : 0.82, i ? 0.92 : 0.82);
            cairo_rectangle(cr, xx, yy, s, s);
            cairo_fill(cr);
        }
    }
    cairo_restore(cr);
}

static void draw_image_item(cairo_t *cr, ImageItem *it) {
    // Create subpixbuf for crop
    GdkPixbuf *sub = gdk_pixbuf_new_subpixbuf(it->pixbuf, it->crop_x, it->crop_y, it->crop_w, it->crop_h);
    cairo_save(cr);
    cairo_translate(cr, it->x, it->y);
    double sx = it->width / (double)it->crop_w;
    double sy = it->height / (double)it->crop_h;
    cairo_scale(cr, sx, sy);
    gdk_cairo_set_source_pixbuf(cr, sub, 0, 0);
    cairo_rectangle(cr, 0, 0, it->crop_w, it->crop_h);
    cairo_fill(cr);
    cairo_restore(cr);
    g_object_unref(sub);
}

static void draw_selection(cairo_t *cr, ImageItem *it) {
    cairo_save(cr);
    cairo_set_source_rgba(cr, 0.2, 0.6, 1.0, 0.8);
    cairo_set_line_width(cr, 2.0);
    cairo_rectangle(cr, it->x, it->y, it->width, it->height);
    cairo_stroke(cr);
    // handles - drawn larger for easier clicking
    cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.95);
    double hs = 8.0;
    double x0 = it->x, y0 = it->y, x1 = it->x + it->width, y1 = it->y + it->height;
    double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0;
    double pts[8][2] = {{x0,y0},{cx,y0},{x1,y0},{x1,cy},{x1,y1},{cx,y1},{x0,y1},{x0,cy}};
    for (int i=0;i<8;i++) {
        cairo_rectangle(cr, pts[i][0]-hs, pts[i][1]-hs, hs*2, hs*2);
        cairo_fill_preserve(cr);
        cairo_set_source_rgba(cr, 0.2, 0.6, 1.0, 0.9);
        cairo_set_line_width(cr, 1.5);
        cairo_stroke(cr);
        cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.95);
    }
    cairo_restore(cr);
}

static void draw_crop_overlay(cairo_t *cr, ImageItem *it) {
    // Show crop rect inside item area with handles
    cairo_save(cr);
    // Map crop rect (in source pixels) to page coordinates inside item box
    double sx = it->width / (double)it->crop_w;
    double sy = it->height / (double)it->crop_h;
    double ox = it->x - it->crop_x * sx;
    double oy = it->y - it->crop_y * sy;
    double rx = it->crop_x * sx + ox;
    double ry = it->crop_y * sy + oy;
    double rw = it->crop_w * sx;
    double rh = it->crop_h * sy;

    // darken outside crop area
    cairo_set_source_rgba(cr, 0, 0, 0, 0.5);
    cairo_rectangle(cr, it->x, it->y, it->width, it->height);
    cairo_rectangle(cr, rx, ry, rw, rh);
    cairo_set_fill_rule(cr, CAIRO_FILL_RULE_EVEN_ODD);
    cairo_fill_preserve(cr);
    cairo_set_fill_rule(cr, CAIRO_FILL_RULE_WINDING);

    // crop rect border
    cairo_set_source_rgba(cr, 1.0, 0.8, 0.0, 0.95);
    cairo_set_line_width(cr, 2.5);
    cairo_rectangle(cr, rx, ry, rw, rh);
    cairo_stroke(cr);
    
    // crop handles - white with yellow border
    cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.95);
    double hs = 8.0;
    double x0 = rx, y0 = ry, x1 = rx + rw, y1 = ry + rh;
    double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0;
    double pts[8][2] = {{x0,y0},{cx,y0},{x1,y0},{x1,cy},{x1,y1},{cx,y1},{x0,y1},{x0,cy}};
    for (int i=0;i<8;i++) {
        cairo_rectangle(cr, pts[i][0]-hs, pts[i][1]-hs, hs*2, hs*2);
        cairo_fill_preserve(cr);
        cairo_set_source_rgba(cr, 1.0, 0.8, 0.0, 0.9);
        cairo_set_line_width(cr, 1.5);
        cairo_stroke(cr);
        cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.95);
    }
    cairo_restore(cr);
}

static void draw_page_and_items(CheatCanvas *self, cairo_t *cr, int width, int height) {
    // background checker
    draw_checker(cr, 0, 0, width, height);

    // page rect in px
    double pw = A4_WIDTH_PT * self->zoom;
    double ph = A4_HEIGHT_PT * self->zoom;
    double offx = (width - pw) / 2.0;
    double offy = (height - ph) / 2.0;

    cairo_save(cr);
    cairo_translate(cr, offx, offy);

    // page drop shadow
    cairo_set_source_rgba(cr, 0,0,0,0.25);
    cairo_rectangle(cr, 5, 5, pw, ph);
    cairo_fill(cr);

    // page background
    cairo_set_source_rgb(cr, 1, 1, 1);
    cairo_rectangle(cr, 0, 0, pw, ph);
    cairo_fill(cr);

    // scale to page points
    cairo_scale(cr, self->zoom, self->zoom);

    // draw items
    if (!self->doc) { cairo_restore(cr); return; }
    Page *p = document_current_page(self->doc);
    for (GList *l = p->items; l; l = l->next) {
        ImageItem *it = (ImageItem*)l->data;
        draw_image_item(cr, it);
    }

    // overlays
    if (self->selected) {
        draw_selection(cr, self->selected);
        if (self->crop_mode) draw_crop_overlay(cr, self->selected);
    }

    cairo_restore(cr);
}

static gboolean on_draw(GtkWidget *w, cairo_t *cr, gpointer user_data) {
    (void)user_data;
    CheatCanvas *self = CHEAT_CANVAS(w);
    GtkAllocation alloc; gtk_widget_get_allocation(w, &alloc);
    draw_page_and_items(self, cr, alloc.width, alloc.height);
    return FALSE;
}

static int hit_handle(ImageItem *it, double px, double py, double tol) {
    // return index 0..7 as in draw_selection, or -1
    // tolerance should be handle size (8.0) + some margin
    double x0 = it->x, y0 = it->y, x1 = it->x + it->width, y1 = it->y + it->height;
    double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0;
    double pts[8][2] = {{x0,y0},{cx,y0},{x1,y0},{x1,cy},{x1,y1},{cx,y1},{x0,y1},{x0,cy}};
    for (int i=0;i<8;i++) {
        if (fabs(px - pts[i][0]) <= tol && fabs(py - pts[i][1]) <= tol) return i;
    }
    return -1;
}

static void crop_rect_page_coords(ImageItem *it, double *rx, double *ry, double *rw, double *rh) {
    double sx = it->width / (double)it->crop_w;
    double sy = it->height / (double)it->crop_h;
    double ox = it->x - it->crop_x * sx;
    double oy = it->y - it->crop_y * sy;
    if (rx) *rx = it->crop_x * sx + ox;
    if (ry) *ry = it->crop_y * sy + oy;
    if (rw) *rw = it->crop_w * sx;
    if (rh) *rh = it->crop_h * sy;
}

static int hit_crop_handle(ImageItem *it, double px, double py, double tol) {
    double rx, ry, rw, rh; crop_rect_page_coords(it, &rx, &ry, &rw, &rh);
    double x0 = rx, y0 = ry, x1 = rx + rw, y1 = ry + rh;
    double cx = (x0 + x1) / 2.0, cy = (y0 + y1) / 2.0;
    double pts[8][2] = {{x0,y0},{cx,y0},{x1,y0},{x1,cy},{x1,y1},{cx,y1},{x0,y1},{x0,cy}};
    for (int i=0;i<8;i++) {
        if (fabs(px - pts[i][0]) <= tol && fabs(py - pts[i][1]) <= tol) return i;
    }
    return -1;
}

static gboolean on_button_press(GtkWidget *w, GdkEventButton *ev, gpointer user_data) {
    (void)user_data;
    CheatCanvas *self = CHEAT_CANVAS(w);
    if (ev->button != GDK_BUTTON_PRIMARY) return FALSE;

    GtkAllocation alloc; gtk_widget_get_allocation(w, &alloc);
    double px, py; px_to_page(self, ev->x, ev->y, &px, &py, alloc.width, alloc.height);

    ImageItem *hit = self->doc ? hit_test(self, px, py) : NULL;
    self->selected = hit;
    if (hit) {
        Page *p = document_current_page(self->doc);
        page_bring_to_front(p, hit);
        self->dragging = TRUE;
        self->drag_start_px = ev->x; self->drag_start_py = ev->y;
        self->orig_x = hit->x; self->orig_y = hit->y; self->orig_w = hit->width; self->orig_h = hit->height;
        self->orig_cx = hit->crop_x; self->orig_cy = hit->crop_y; self->orig_cw = hit->crop_w; self->orig_ch = hit->crop_h;
        // Use handle size + margin for hit detection (10.0 points tolerance)
        int handle = hit_handle(hit, px, py, 10.0);
        if (self->crop_mode) {
            int ch = hit_crop_handle(hit, px, py, 10.0);
            self->drag_kind = DRAG_CROP; self->drag_handle = ch; // -1 means move crop rect
        } else if (handle >= 0) {
            self->drag_kind = DRAG_RESIZE; self->drag_handle = handle;
        } else {
            self->drag_kind = DRAG_MOVE;
        }
    } else {
        self->dragging = FALSE;
    }
    cheat_canvas_queue_redraw(self);
    return TRUE;
}

static gboolean on_button_release(GtkWidget *w, GdkEventButton *ev, gpointer user_data) {
    (void)user_data;
    CheatCanvas *self = CHEAT_CANVAS(w);
    if (ev->button != GDK_BUTTON_PRIMARY) return FALSE;
    self->dragging = FALSE;
    self->drag_kind = DRAG_NONE;
    return TRUE;
}

static gboolean on_motion(GtkWidget *w, GdkEventMotion *ev, gpointer user_data) {
    (void)user_data;
    CheatCanvas *self = CHEAT_CANVAS(w);
    
    if (!self->dragging) {
        // Update cursor based on what we're hovering over
        if (self->selected) {
            GtkAllocation alloc; gtk_widget_get_allocation(w, &alloc);
            double px, py; px_to_page(self, ev->x, ev->y, &px, &py, alloc.width, alloc.height);
            int handle = -1;
            if (self->crop_mode) {
                handle = hit_crop_handle(self->selected, px, py, 10.0);
            } else {
                handle = hit_handle(self->selected, px, py, 10.0);
            }
            GdkWindow *window = gtk_widget_get_window(w);
            if (handle >= 0 && window) {
                // Over a handle - show resize cursor
                GdkCursor *cursor = gdk_cursor_new_for_display(gdk_display_get_default(), GDK_FLEUR);
                gdk_window_set_cursor(window, cursor);
                g_object_unref(cursor);
            } else if (window) {
                gdk_window_set_cursor(window, NULL); // default cursor
            }
        }
        return FALSE;
    }
    
    if (!self->selected) return FALSE;
    GtkAllocation alloc; gtk_widget_get_allocation(w, &alloc);

    double dpx = (ev->x - self->drag_start_px) / self->zoom;
    double dpy = (ev->y - self->drag_start_py) / self->zoom;

    ImageItem *it = self->selected;
    if (self->drag_kind == DRAG_MOVE) {
        it->x = self->orig_x + dpx;
        it->y = self->orig_y + dpy;
    } else if (self->drag_kind == DRAG_RESIZE) {
        // simple resize from handle, no aspect by default
        double nx = self->orig_x, ny = self->orig_y, nw = self->orig_w, nh = self->orig_h;
        int h = self->drag_handle;
        if (h == 0 || h == 7 || h == 6) { // left edges
            nx = self->orig_x + dpx;
            nw = self->orig_w - dpx;
        }
        if (h == 2 || h == 3 || h == 4) { // right edges
            nw = self->orig_w + dpx;
        }
        if (h == 0 || h == 1 || h == 2) { // top edges
            ny = self->orig_y + dpy;
            nh = self->orig_h - dpy;
        }
        if (h == 4 || h == 5 || h == 6) { // bottom edges
            nh = self->orig_h + dpy;
        }
        // constrain minimum size
        if (nw < 10) { nx += nw - 10; nw = 10; }
        if (nh < 10) { ny += nh - 10; nh = 10; }
        it->x = nx; it->y = ny; it->width = nw; it->height = nh;
    } else if (self->drag_kind == DRAG_CROP) {
        // convert movement into source pixel delta
        double scale_x = self->orig_w / (double)self->orig_cw;
        double scale_y = self->orig_h / (double)self->orig_ch;
        int ddx = (int)round(dpx / scale_x);
        int ddy = (int)round(dpy / scale_y);
        int imgw = gdk_pixbuf_get_width(it->pixbuf);
        int imgh = gdk_pixbuf_get_height(it->pixbuf);
        int cx = self->orig_cx, cy = self->orig_cy, cw = self->orig_cw, ch = self->orig_ch;
        if (self->drag_handle < 0) {
            // move crop rect
            cx += ddx; cy += ddy;
        } else {
            // resize crop from handle similar to item resize
            int h = self->drag_handle;
            if (h == 0 || h == 7 || h == 6) { // left edges
                cx += ddx; cw -= ddx;
            }
            if (h == 2 || h == 3 || h == 4) { // right edges
                cw += ddx;
            }
            if (h == 0 || h == 1 || h == 2) { // top edges
                cy += ddy; ch -= ddy;
            }
            if (h == 4 || h == 5 || h == 6) { // bottom edges
                ch += ddy;
            }
        }
        // clamp to image bounds and minimum size
        if (cw < 5) cw = 5;
        if (ch < 5) ch = 5;
        if (cx < 0) cx = 0;
        if (cy < 0) cy = 0;
        if (cx + cw > imgw) { if (self->drag_handle < 0) cx = imgw - cw; else cw = imgw - cx; }
        if (cy + ch > imgh) { if (self->drag_handle < 0) cy = imgh - ch; else ch = imgh - cy; }
        it->crop_x = cx; it->crop_y = cy; it->crop_w = cw; it->crop_h = ch;
        // Update item size to maintain aspect of crop
        double aspect = (double)cw / (double)ch;
        it->height = it->width / aspect;
    }

    cheat_canvas_queue_redraw(self);
    return TRUE;
}

static gboolean on_scroll(GtkWidget *w, GdkEventScroll *ev, gpointer user_data) {
    (void)user_data;
    CheatCanvas *self = CHEAT_CANVAS(w);
    if (ev->direction == GDK_SCROLL_UP) cheat_canvas_zoom_in(self);
    else if (ev->direction == GDK_SCROLL_DOWN) cheat_canvas_zoom_out(self);
    return TRUE;
}
