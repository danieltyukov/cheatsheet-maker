#pragma once
#include <gtk/gtk.h>
#include "document.h"

G_BEGIN_DECLS

#define CHEAT_TYPE_CANVAS (cheat_canvas_get_type())
G_DECLARE_FINAL_TYPE(CheatCanvas, cheat_canvas, CHEAT, CANVAS, GtkDrawingArea)

GtkWidget *cheat_canvas_new(Document *doc);
void cheat_canvas_set_document(CheatCanvas *self, Document *doc);
Document *cheat_canvas_get_document(CheatCanvas *self);

void cheat_canvas_zoom_in(CheatCanvas *self);
void cheat_canvas_zoom_out(CheatCanvas *self);
void cheat_canvas_zoom_reset(CheatCanvas *self);

void cheat_canvas_toggle_crop_mode(CheatCanvas *self);
void cheat_canvas_toggle_draw_mode(CheatCanvas *self);
void cheat_canvas_set_draw_color(CheatCanvas *self, double r, double g, double b, double a);
void cheat_canvas_set_draw_width(CheatCanvas *self, double width);

// Add an image to the current page centered; takes ownership reference of pixbuf
void cheat_canvas_add_pixbuf(CheatCanvas *self, GdkPixbuf *pixbuf);

// Helpers used by main window actions
void cheat_canvas_delete_selection(CheatCanvas *self);
void cheat_canvas_next_page(CheatCanvas *self);
void cheat_canvas_prev_page(CheatCanvas *self);

G_END_DECLS
