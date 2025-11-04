#include "serialize.h"
#include <json-glib/json-glib.h>
#include <string.h>

gchar *get_autosave_path(void) {
    const gchar *config_dir = g_get_user_config_dir();
    gchar *app_dir = g_build_filename(config_dir, "cheatsheet-maker", NULL);
    g_mkdir_with_parents(app_dir, 0755);
    gchar *path = g_build_filename(app_dir, "autosave.json", NULL);
    g_free(app_dir);
    return path;
}

// Convert pixbuf to base64 PNG data
static gchar *pixbuf_to_base64(GdkPixbuf *pixbuf, GError **error) {
    gchar *buffer = NULL;
    gsize buffer_size = 0;
    
    if (!gdk_pixbuf_save_to_buffer(pixbuf, &buffer, &buffer_size, "png", error, NULL)) {
        return NULL;
    }
    
    gchar *base64 = g_base64_encode((const guchar*)buffer, buffer_size);
    g_free(buffer);
    return base64;
}

// Convert base64 PNG data to pixbuf
static GdkPixbuf *pixbuf_from_base64(const gchar *base64, GError **error) {
    gsize data_len = 0;
    guchar *data = g_base64_decode(base64, &data_len);
    
    GInputStream *stream = g_memory_input_stream_new_from_data(data, data_len, g_free);
    GdkPixbuf *pixbuf = gdk_pixbuf_new_from_stream(stream, NULL, error);
    g_object_unref(stream);
    
    return pixbuf;
}

gboolean document_save_to_file(Document *doc, const char *filepath, GError **error) {
    if (!doc || !filepath) {
        g_set_error(error, G_FILE_ERROR, G_FILE_ERROR_INVAL, "Invalid parameters");
        return FALSE;
    }
    
    JsonBuilder *builder = json_builder_new();
    json_builder_begin_object(builder);
    
    // Save current page index
    json_builder_set_member_name(builder, "current_page");
    json_builder_add_int_value(builder, doc->current_page);
    
    // Save pages array
    json_builder_set_member_name(builder, "pages");
    json_builder_begin_array(builder);
    
    for (guint i = 0; i < doc->pages->len; i++) {
        Page *page = (Page*)g_ptr_array_index(doc->pages, i);
        json_builder_begin_object(builder);
        
        // Save items array
        json_builder_set_member_name(builder, "items");
        json_builder_begin_array(builder);
        
        for (GList *l = page->items; l; l = l->next) {
            ImageItem *item = (ImageItem*)l->data;
            json_builder_begin_object(builder);
            
            // Save image data as base64
            GError *img_error = NULL;
            gchar *img_data = pixbuf_to_base64(item->pixbuf, &img_error);
            if (!img_data) {
                g_warning("Failed to encode image: %s", img_error ? img_error->message : "unknown");
                if (img_error) g_error_free(img_error);
                continue;
            }
            
            json_builder_set_member_name(builder, "image_data");
            json_builder_add_string_value(builder, img_data);
            g_free(img_data);
            
            // Save position and size
            json_builder_set_member_name(builder, "x");
            json_builder_add_double_value(builder, item->x);
            json_builder_set_member_name(builder, "y");
            json_builder_add_double_value(builder, item->y);
            json_builder_set_member_name(builder, "width");
            json_builder_add_double_value(builder, item->width);
            json_builder_set_member_name(builder, "height");
            json_builder_add_double_value(builder, item->height);
            
            // Save crop info
            json_builder_set_member_name(builder, "crop_x");
            json_builder_add_int_value(builder, item->crop_x);
            json_builder_set_member_name(builder, "crop_y");
            json_builder_add_int_value(builder, item->crop_y);
            json_builder_set_member_name(builder, "crop_w");
            json_builder_add_int_value(builder, item->crop_w);
            json_builder_set_member_name(builder, "crop_h");
            json_builder_add_int_value(builder, item->crop_h);
            
            json_builder_end_object(builder);
        }
        
        json_builder_end_array(builder);
        json_builder_end_object(builder);
    }
    
    json_builder_end_array(builder);
    json_builder_end_object(builder);
    
    // Write to file
    JsonGenerator *gen = json_generator_new();
    JsonNode *root = json_builder_get_root(builder);
    json_generator_set_root(gen, root);
    json_generator_set_pretty(gen, TRUE);
    
    gboolean success = json_generator_to_file(gen, filepath, error);
    
    json_node_free(root);
    g_object_unref(gen);
    g_object_unref(builder);
    
    return success;
}

Document *document_load_from_file(const char *filepath, GError **error) {
    if (!filepath) {
        g_set_error(error, G_FILE_ERROR, G_FILE_ERROR_INVAL, "Invalid filepath");
        return NULL;
    }
    
    // Check if file exists
    if (!g_file_test(filepath, G_FILE_TEST_EXISTS)) {
        g_set_error(error, G_FILE_ERROR, G_FILE_ERROR_NOENT, "File does not exist");
        return NULL;
    }
    
    JsonParser *parser = json_parser_new();
    if (!json_parser_load_from_file(parser, filepath, error)) {
        g_object_unref(parser);
        return NULL;
    }
    
    JsonNode *root = json_parser_get_root(parser);
    if (!JSON_NODE_HOLDS_OBJECT(root)) {
        g_set_error(error, G_FILE_ERROR, G_FILE_ERROR_INVAL, "Invalid JSON format");
        g_object_unref(parser);
        return NULL;
    }
    
    JsonObject *root_obj = json_node_get_object(root);
    
    // Create new document (starts with 1 empty page)
    Document *doc = document_new();
    
    // Clear the default page - we'll load pages from file
    g_ptr_array_remove_index(doc->pages, 0);
    
    // Load current page index
    if (json_object_has_member(root_obj, "current_page")) {
        doc->current_page = json_object_get_int_member(root_obj, "current_page");
    }
    
    // Load pages
    if (!json_object_has_member(root_obj, "pages")) {
        document_free(doc);
        g_set_error(error, G_FILE_ERROR, G_FILE_ERROR_INVAL, "Missing pages array");
        g_object_unref(parser);
        return NULL;
    }
    
    JsonArray *pages_array = json_object_get_array_member(root_obj, "pages");
    guint num_pages = json_array_get_length(pages_array);
    
    for (guint i = 0; i < num_pages; i++) {
        JsonNode *page_node = json_array_get_element(pages_array, i);
        if (!JSON_NODE_HOLDS_OBJECT(page_node)) continue;
        
        JsonObject *page_obj = json_node_get_object(page_node);
        Page *page = g_new0(Page, 1);
        page->items = NULL;
        
        // Load items
        if (json_object_has_member(page_obj, "items")) {
            JsonArray *items_array = json_object_get_array_member(page_obj, "items");
            guint num_items = json_array_get_length(items_array);
            
            for (guint j = 0; j < num_items; j++) {
                JsonNode *item_node = json_array_get_element(items_array, j);
                if (!JSON_NODE_HOLDS_OBJECT(item_node)) continue;
                
                JsonObject *item_obj = json_node_get_object(item_node);
                
                // Load image
                const gchar *img_data = json_object_get_string_member(item_obj, "image_data");
                GError *img_error = NULL;
                GdkPixbuf *pixbuf = pixbuf_from_base64(img_data, &img_error);
                if (!pixbuf) {
                    g_warning("Failed to decode image: %s", img_error ? img_error->message : "unknown");
                    if (img_error) g_error_free(img_error);
                    continue;
                }
                
                // Create item
                ImageItem *item = g_new0(ImageItem, 1);
                item->pixbuf = pixbuf;
                
                // Load position and size
                item->x = json_object_get_double_member(item_obj, "x");
                item->y = json_object_get_double_member(item_obj, "y");
                item->width = json_object_get_double_member(item_obj, "width");
                item->height = json_object_get_double_member(item_obj, "height");
                
                // Load crop info
                item->crop_x = json_object_get_int_member(item_obj, "crop_x");
                item->crop_y = json_object_get_int_member(item_obj, "crop_y");
                item->crop_w = json_object_get_int_member(item_obj, "crop_w");
                item->crop_h = json_object_get_int_member(item_obj, "crop_h");
                
                // Add to page
                page->items = g_list_append(page->items, item);
            }
        }
        
        g_ptr_array_add(doc->pages, page);
    }
    
    // Ensure at least one page exists
    if (doc->pages->len == 0) {
        Page *default_page = g_new0(Page, 1);
        default_page->items = NULL;
        g_ptr_array_add(doc->pages, default_page);
    }
    
    // Clamp current page index
    if (doc->current_page >= (int)doc->pages->len) {
        doc->current_page = (int)doc->pages->len - 1;
    }
    if (doc->current_page < 0) {
        doc->current_page = 0;
    }
    
    g_object_unref(parser);
    return doc;
}
