#include "image_io.h"

GdkPixbuf *load_pixbuf_from_file(const char *path, GError **error) {
    g_return_val_if_fail(path != NULL, NULL);
    return gdk_pixbuf_new_from_file(path, error);
}

GdkPixbuf *clipboard_get_image_sync(GtkWidget *for_widget) {
    GtkClipboard *cb = gtk_widget_get_clipboard(for_widget, GDK_SELECTION_CLIPBOARD);
    if (!cb) return NULL;
    // Prefer image directly
    GdkPixbuf *img = gtk_clipboard_wait_for_image(cb);
    if (img) return img;
    // Try uris
    gchar **uris = gtk_clipboard_wait_for_uris(cb);
    if (uris && uris[0]) {
        gchar *filename = g_filename_from_uri(uris[0], NULL, NULL);
        if (filename) {
            GError *err = NULL;
            GdkPixbuf *pb = gdk_pixbuf_new_from_file(filename, &err);
            g_free(filename);
            g_strfreev(uris);
            if (pb) return pb;
            if (err) g_error_free(err);
        }
    }
    if (uris) g_strfreev(uris);
    // Try text path
    gchar *text = gtk_clipboard_wait_for_text(cb);
    if (text) {
        GError *err = NULL;
        GdkPixbuf *pb = gdk_pixbuf_new_from_file(text, &err);
        g_free(text);
        if (pb) return pb;
        if (err) g_error_free(err);
    }
    return NULL;
}
