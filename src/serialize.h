#pragma once

#include <gtk/gtk.h>
#include "document.h"

#ifdef __cplusplus
extern "C" {
#endif

// Save a document to a JSON file
gboolean document_save_to_file(Document *doc, const char *filepath, GError **error);

// Load a document from a JSON file
Document *document_load_from_file(const char *filepath, GError **error);

// Get the default auto-save file path
gchar *get_autosave_path(void);

#ifdef __cplusplus
}
#endif
