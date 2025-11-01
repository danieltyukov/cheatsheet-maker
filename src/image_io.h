#pragma once
#include <gtk/gtk.h>

GdkPixbuf *load_pixbuf_from_file(const char *path, GError **error);
GdkPixbuf *clipboard_get_image_sync(GtkWidget *for_widget);
