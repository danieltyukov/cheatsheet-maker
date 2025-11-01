#include <gtk/gtk.h>
#include "document.h"
#include "canvas.h"
#include "image_io.h"
#include "pdf_export.h"

typedef struct AppState {
    GtkApplication *app;
    GtkWidget *window;
    CheatCanvas *canvas;
    Document *doc;
    GtkWidget *page_label;
} AppState;

static void update_page_label(AppState *st) {
    if (!st->doc) return;
    int idx = st->doc->current_page + 1;
    int total = document_page_count(st->doc);
    gchar *txt = g_strdup_printf("Page %d / %d", idx, total);
    gtk_label_set_text(GTK_LABEL(st->page_label), txt);
    g_free(txt);
}

static void on_action_new(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    AppState *st = (AppState*)user_data;
    if (st->doc) document_free(st->doc);
    st->doc = document_new();
    cheat_canvas_set_document(st->canvas, st->doc);
    update_page_label(st);
}

static void import_image_from_file(AppState *st) {
    GtkWidget *dlg = gtk_file_chooser_dialog_new("Import Image", GTK_WINDOW(st->window), GTK_FILE_CHOOSER_ACTION_OPEN,
                                                 "Cancel", GTK_RESPONSE_CANCEL, "Open", GTK_RESPONSE_ACCEPT, NULL);
    GtkFileFilter *ff = gtk_file_filter_new();
    gtk_file_filter_set_name(ff, "Images");
    gtk_file_filter_add_pixbuf_formats(ff);
    gtk_file_chooser_add_filter(GTK_FILE_CHOOSER(dlg), ff);
    if (gtk_dialog_run(GTK_DIALOG(dlg)) == GTK_RESPONSE_ACCEPT) {
        char *path = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dlg));
        GError *err = NULL;
        GdkPixbuf *pb = load_pixbuf_from_file(path, &err);
        if (pb) {
            cheat_canvas_add_pixbuf(st->canvas, pb);
            g_object_unref(pb);
        } else {
            GtkWidget *md = gtk_message_dialog_new(GTK_WINDOW(st->window), GTK_DIALOG_MODAL, GTK_MESSAGE_ERROR, GTK_BUTTONS_CLOSE,
                                                  "Failed to load image: %s", err ? err->message : "unknown error");
            gtk_dialog_run(GTK_DIALOG(md));
            gtk_widget_destroy(md);
            if (err) g_error_free(err);
        }
        g_free(path);
    }
    gtk_widget_destroy(dlg);
}

static void on_action_import(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    import_image_from_file((AppState*)user_data);
}

static void on_action_paste(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    AppState *st = (AppState*)user_data;
    GdkPixbuf *pb = clipboard_get_image_sync(GTK_WIDGET(st->window));
    if (pb) {
        cheat_canvas_add_pixbuf(st->canvas, pb);
        g_object_unref(pb);
    }
}

static void on_action_export_pdf(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    AppState *st = (AppState*)user_data;
    GtkWidget *dlg = gtk_file_chooser_dialog_new("Export PDF", GTK_WINDOW(st->window), GTK_FILE_CHOOSER_ACTION_SAVE,
                                                 "Cancel", GTK_RESPONSE_CANCEL, "Export", GTK_RESPONSE_ACCEPT, NULL);
    gtk_file_chooser_set_current_name(GTK_FILE_CHOOSER(dlg), "cheatsheet.pdf");
    if (gtk_dialog_run(GTK_DIALOG(dlg)) == GTK_RESPONSE_ACCEPT) {
        char *path = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dlg));
        GError *err = NULL;
        if (!export_document_to_pdf(st->doc, path, &err)) {
            GtkWidget *md = gtk_message_dialog_new(GTK_WINDOW(st->window), GTK_DIALOG_MODAL, GTK_MESSAGE_ERROR, GTK_BUTTONS_CLOSE,
                                                  "Failed to export PDF: %s", err ? err->message : "unknown error");
            gtk_dialog_run(GTK_DIALOG(md));
            gtk_widget_destroy(md);
            if (err) g_error_free(err);
        }
        g_free(path);
    }
    gtk_widget_destroy(dlg);
}

static void on_action_prev_page(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    AppState *st = (AppState*)user_data;
    cheat_canvas_prev_page(st->canvas);
    update_page_label(st);
}

static void on_action_next_page(GtkWidget *btn, gpointer user_data) {
    (void)btn;
    AppState *st = (AppState*)user_data;
    cheat_canvas_next_page(st->canvas);
    update_page_label(st);
}

static gboolean on_key_press(GtkWidget *w, GdkEventKey *ev, gpointer user_data) {
    (void)w;
    AppState *st = (AppState*)user_data;
    guint key = ev->keyval;
    guint state = ev->state & gtk_accelerator_get_default_mod_mask();
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_e) { on_action_export_pdf(NULL, st); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_o) { on_action_import(NULL, st); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_v) { on_action_paste(NULL, st); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_plus) { cheat_canvas_zoom_in(st->canvas); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_minus) { cheat_canvas_zoom_out(st->canvas); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_0) { cheat_canvas_zoom_reset(st->canvas); return TRUE; }
    if (key == GDK_KEY_Delete || key == GDK_KEY_BackSpace) { cheat_canvas_delete_selection(st->canvas); return TRUE; }
    if (key == GDK_KEY_c || key == GDK_KEY_C) { cheat_canvas_toggle_crop_mode(st->canvas); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_Page_Up) { on_action_prev_page(NULL, st); return TRUE; }
    if ((state & GDK_CONTROL_MASK) && key == GDK_KEY_Page_Down) { on_action_next_page(NULL, st); return TRUE; }
    return FALSE;
}

static void on_drag_data_received(GtkWidget *w, GdkDragContext *ctx, gint x, gint y, GtkSelectionData *data, guint info, guint time, gpointer u) {
    AppState *st = (AppState*)u;
    (void)w; (void)ctx; (void)x; (void)y; (void)info; (void)time;
    if (gtk_selection_data_get_length(data) <= 0) return;
    gchar **uris = gtk_selection_data_get_uris(data);
    if (!uris) return;
    for (int i = 0; uris[i]; i++) {
        gchar *filename = g_filename_from_uri(uris[i], NULL, NULL);
        if (filename) {
            GError *err = NULL;
            GdkPixbuf *pb = gdk_pixbuf_new_from_file(filename, &err);
            if (pb) {
                cheat_canvas_add_pixbuf(st->canvas, pb);
                g_object_unref(pb);
            }
            if (err) { g_error_free(err); }
            g_free(filename);
        }
    }
    g_strfreev(uris);
}

static void setup_dnd(GtkWidget *widget, AppState *st) {
    GtkTargetEntry targets[] = {
        { (gchar*)"text/uri-list", 0, 0 }
    };
    gtk_drag_dest_set(widget, GTK_DEST_DEFAULT_ALL, targets, 1, GDK_ACTION_COPY);
    g_signal_connect(widget, "drag-data-received", G_CALLBACK(on_drag_data_received), st);
}

static void on_crop_toggled(GtkToggleButton *b, gpointer u) {
    (void)b;
    AppState *st = (AppState*)u;
    if (!st || !st->canvas) return;
    cheat_canvas_toggle_crop_mode(st->canvas);
}

static void activate(GtkApplication* app, gpointer user_data) {
    (void)user_data;
    AppState *st = g_new0(AppState, 1);
    st->app = app;
    st->doc = document_new();

    GtkWidget *win = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(win), "Cheatsheet Maker");
    gtk_window_set_default_size(GTK_WINDOW(win), 1000, 800);
    st->window = win;

    GtkWidget *vbox = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
    gtk_container_add(GTK_CONTAINER(win), vbox);

    // Create canvas early so handlers can safely reference it
    st->canvas = CHEAT_CANVAS(cheat_canvas_new(st->doc));
    GtkWidget *canvas = GTK_WIDGET(st->canvas);
    gtk_widget_set_hexpand(canvas, TRUE);
    gtk_widget_set_vexpand(canvas, TRUE);

    // Toolbar
    GtkWidget *toolbar = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 4);
    gtk_style_context_add_class(gtk_widget_get_style_context(toolbar), "toolbar");
    gtk_box_pack_start(GTK_BOX(vbox), toolbar, FALSE, FALSE, 0);

    GtkWidget *btn_new = gtk_button_new_with_label("New");
    g_signal_connect(btn_new, "clicked", G_CALLBACK(on_action_new), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_new, FALSE, FALSE, 4);

    GtkWidget *btn_import = gtk_button_new_with_label("Import Image");
    g_signal_connect(btn_import, "clicked", G_CALLBACK(on_action_import), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_import, FALSE, FALSE, 4);

    GtkWidget *btn_paste = gtk_button_new_with_label("Paste");
    g_signal_connect(btn_paste, "clicked", G_CALLBACK(on_action_paste), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_paste, FALSE, FALSE, 4);

    GtkWidget *btn_crop = gtk_toggle_button_new_with_label("Crop");
    // Connect with AppState so we can access canvas reliably
    g_signal_connect(btn_crop, "toggled", G_CALLBACK(on_crop_toggled), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_crop, FALSE, FALSE, 4);

    GtkWidget *btn_export = gtk_button_new_with_label("Export PDF");
    g_signal_connect(btn_export, "clicked", G_CALLBACK(on_action_export_pdf), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_export, FALSE, FALSE, 4);

    GtkWidget *sp = gtk_separator_new(GTK_ORIENTATION_VERTICAL);
    gtk_box_pack_start(GTK_BOX(toolbar), sp, FALSE, FALSE, 8);

    GtkWidget *btn_prev = gtk_button_new_with_label("◀ Prev");
    g_signal_connect(btn_prev, "clicked", G_CALLBACK(on_action_prev_page), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_prev, FALSE, FALSE, 4);

    st->page_label = gtk_label_new("");
    gtk_box_pack_start(GTK_BOX(toolbar), st->page_label, FALSE, FALSE, 8);

    GtkWidget *btn_next = gtk_button_new_with_label("Next ▶");
    g_signal_connect(btn_next, "clicked", G_CALLBACK(on_action_next_page), st);
    gtk_box_pack_start(GTK_BOX(toolbar), btn_next, FALSE, FALSE, 4);

    // Pack canvas after toolbar for proper layout
    gtk_box_pack_start(GTK_BOX(vbox), canvas, TRUE, TRUE, 0);

    // DnD
    setup_dnd(canvas, st);

    g_signal_connect(win, "key-press-event", G_CALLBACK(on_key_press), st);

    update_page_label(st);
    gtk_widget_show_all(win);
}

int main(int argc, char **argv) {
    GtkApplication *app = gtk_application_new("com.example.cheatsheet", G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app, "activate", G_CALLBACK(activate), NULL);
    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);
    return status;
}
