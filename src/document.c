#include "document.h"

static Page *page_new(void) {
    Page *p = g_new0(Page, 1);
    p->items = NULL;
    return p;
}

static void page_free(Page *p) {
    for (GList *l = p->items; l; l = l->next) {
        image_item_free((ImageItem*)l->data);
    }
    g_list_free(p->items);
    g_free(p);
}

Document *document_new(void) {
    Document *d = g_new0(Document, 1);
    d->pages = g_ptr_array_new_with_free_func((GDestroyNotify)page_free);
    d->current_page = 0;
    // start with a single page
    Page *first = page_new();
    g_ptr_array_add(d->pages, first);
    return d;
}

void document_free(Document *doc) {
    if (!doc) return;
    g_ptr_array_free(doc->pages, TRUE);
    g_free(doc);
}

Page *document_add_page(Document *doc) {
    g_return_val_if_fail(doc != NULL, NULL);
    Page *p = page_new();
    g_ptr_array_add(doc->pages, p);
    doc->current_page = (int)doc->pages->len - 1;
    return p;
}

void document_remove_current_page(Document *doc) {
    g_return_if_fail(doc != NULL);
    if (doc->pages->len <= 1) return; // keep at least one page
    guint idx = (guint)CLAMP(doc->current_page, 0, (int)doc->pages->len - 1);
    g_ptr_array_remove_index(doc->pages, idx);
    if (doc->current_page >= (int)doc->pages->len) doc->current_page = (int)doc->pages->len - 1;
}

void document_move_page_up(Document *doc) {
    g_return_if_fail(doc != NULL);
    if (doc->current_page <= 0) return; // already at top
    
    // Swap current page with the one above it
    gpointer page = g_ptr_array_index(doc->pages, doc->current_page);
    gpointer prev_page = g_ptr_array_index(doc->pages, doc->current_page - 1);
    
    g_ptr_array_index(doc->pages, doc->current_page) = prev_page;
    g_ptr_array_index(doc->pages, doc->current_page - 1) = page;
    
    doc->current_page--;
}

void document_move_page_down(Document *doc) {
    g_return_if_fail(doc != NULL);
    if (doc->current_page >= (int)doc->pages->len - 1) return; // already at bottom
    
    // Swap current page with the one below it
    gpointer page = g_ptr_array_index(doc->pages, doc->current_page);
    gpointer next_page = g_ptr_array_index(doc->pages, doc->current_page + 1);
    
    g_ptr_array_index(doc->pages, doc->current_page) = next_page;
    g_ptr_array_index(doc->pages, doc->current_page + 1) = page;
    
    doc->current_page++;
}

Page *document_current_page(Document *doc) {
    g_return_val_if_fail(doc != NULL, NULL);
    return (Page*)g_ptr_array_index(doc->pages, (guint)CLAMP(doc->current_page, 0, (int)doc->pages->len - 1));
}

int document_page_count(const Document *doc) {
    return doc ? (int)doc->pages->len : 0;
}

ImageItem *image_item_new(GdkPixbuf *pixbuf) {
    g_return_val_if_fail(pixbuf != NULL, NULL);
    ImageItem *it = g_new0(ImageItem, 1);
    it->pixbuf = g_object_ref(pixbuf);
    int w = gdk_pixbuf_get_width(pixbuf);
    int h = gdk_pixbuf_get_height(pixbuf);
    it->crop_x = 0; it->crop_y = 0; it->crop_w = w; it->crop_h = h;
    // Default size: fit width to 1/2 A4 width, keep aspect
    double target_w = A4_WIDTH_PT * 0.5;
    double scale = target_w / (double)w;
    it->width = target_w;
    it->height = h * scale;
    it->x = (A4_WIDTH_PT - it->width) / 2.0;
    it->y = (A4_HEIGHT_PT - it->height) / 2.0;
    return it;
}

void image_item_free(ImageItem *item) {
    if (!item) return;
    g_clear_object(&item->pixbuf);
    g_free(item);
}

void page_add_item(Page *page, ImageItem *item) {
    g_return_if_fail(page != NULL && item != NULL);
    // Append to end to bring to front
    page->items = g_list_append(page->items, item);
}

void page_remove_item(Page *page, ImageItem *item) {
    g_return_if_fail(page != NULL && item != NULL);
    page->items = g_list_remove(page->items, item);
    image_item_free(item);
}

void page_bring_to_front(Page *page, ImageItem *item) {
    g_return_if_fail(page != NULL && item != NULL);
    GList *link = g_list_find(page->items, item);
    if (!link) return;
    page->items = g_list_remove_link(page->items, link);
    page->items = g_list_concat(page->items, link); // move to tail (front)
}
