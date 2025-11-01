#include "pdf_export.h"
#include <cairo-pdf.h>

static void cairo_draw_image_item(cairo_t *cr, ImageItem *it) {
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

gboolean export_document_to_pdf(Document *doc, const char *filename, GError **error) {
    g_return_val_if_fail(doc != NULL && filename != NULL, FALSE);

    cairo_surface_t *surface = cairo_pdf_surface_create(filename, A4_WIDTH_PT, A4_HEIGHT_PT);
    cairo_status_t status = cairo_surface_status(surface);
    if (status != CAIRO_STATUS_SUCCESS) {
        if (error) *error = g_error_new_literal(g_quark_from_static_string("pdf-export"), status, cairo_status_to_string(status));
        cairo_surface_destroy(surface);
        return FALSE;
    }
    cairo_t *cr = cairo_create(surface);

    for (guint i = 0; i < doc->pages->len; i++) {
        Page *p = (Page*)g_ptr_array_index(doc->pages, i);
        // white background
        cairo_save(cr);
        cairo_set_source_rgb(cr, 1, 1, 1);
        cairo_paint(cr);
        cairo_restore(cr);
        for (GList *l = p->items; l; l = l->next) {
            ImageItem *it = (ImageItem*)l->data;
            cairo_draw_image_item(cr, it);
        }
        if (i + 1 < doc->pages->len) cairo_show_page(cr);
    }
    cairo_destroy(cr);
    cairo_surface_finish(surface);
    cairo_surface_destroy(surface);
    return TRUE;
}
