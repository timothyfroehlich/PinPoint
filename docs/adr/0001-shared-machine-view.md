# One Machine View with route presets

The Machines page and both Collection overviews use one machine-specific view module. A generic grid would expose data loading and domain rules to each caller, while separate tables had already produced different sorting, fields, and responsive behavior. Route presets provide the different defaults and permitted fields without duplicating the query and presentation pipeline.

The loader plans issue, service, and activity enrichment from the active columns, filters, and sort before querying it. This keeps optional fields available without paying their query cost for every view. It returns only the selected page to the browser. The server field catalog owns data dependencies and sorting; the client renderer catalog owns table and compact presentation, so client code cannot import the database layer.

An unmatched Pinball Map or iScored entry is not a PinPoint machine. External entries will get their own representation when the Integrations view is designed; this module does not invent a machine identity or generic row union for them.
