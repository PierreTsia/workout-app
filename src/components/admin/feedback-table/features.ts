import {
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowExpandingFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createExpandedRowModel,
  metaHelper,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
} from "@tanstack/react-table"

export const feedbackTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowExpandingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  tableMeta: metaHelper<{ adminEmail: string }>(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

export type FeedbackTableFeatures = typeof feedbackTableFeatures
