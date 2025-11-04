#pragma once

#include <gtk/gtk.h>

#ifdef __cplusplus
extern "C" {
#endif

// A4 size in typographic points (1pt = 1/72 inch)
#define A4_WIDTH_PT  595.275590551 // 210mm
#define A4_HEIGHT_PT 841.889763780 // 297mm

typedef struct _ImageItem {
    GdkPixbuf *pixbuf;          // referenced image
    double x, y;                // top-left position in page points
    double width, height;       // size on page in points
    int crop_x, crop_y;         // crop origin in source pixels
    int crop_w, crop_h;         // crop size in source pixels
} ImageItem;

typedef struct _Page {
    GList *items;               // list of ImageItem* (front at tail)
} Page;

typedef struct _Document {
    GPtrArray *pages;           // array of Page*
    int current_page;           // index into pages
} Document;

Document *document_new(void);
void document_free(Document *doc);
Page *document_add_page(Document *doc);
void document_remove_current_page(Document *doc);
void document_move_page_up(Document *doc);
void document_move_page_down(Document *doc);
Page *document_current_page(Document *doc);
int document_page_count(const Document *doc);

ImageItem *image_item_new(GdkPixbuf *pixbuf);
void image_item_free(ImageItem *item);

void page_add_item(Page *page, ImageItem *item);
void page_remove_item(Page *page, ImageItem *item);
void page_bring_to_front(Page *page, ImageItem *item);

#ifdef __cplusplus
}
#endif
