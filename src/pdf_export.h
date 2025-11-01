#pragma once
#include <gtk/gtk.h>
#include "document.h"

// Export the whole document to a multi-page PDF at A4 size. Returns TRUE on success.
gboolean export_document_to_pdf(Document *doc, const char *filename, GError **error);
