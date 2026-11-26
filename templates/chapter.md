---
# Chapter template (WRITING-GUIDE.md → "Writing a chapter"). Save it as
#   part-<n>_<part-slug>/chapter-<n>_<chapter-slug>.md
# e.g. part-2_networks/chapter-2_how-the-internet-moves-bytes.md (chapter numbers run on across parts).
# Lines starting with # are notes for you; remove the # to use a field.

# title: "How the Internet Moves Bytes"   # only if the title from the file name isn't right
description: "One sentence that says what this chapter teaches. Shown on cards and in search results."
draft: true          # change to false (or delete the line) when it's ready to publish
featured: false      # true shows it on the homepage under "Featured chapters"
# epigraph: "A short quote that opens the chapter."
# epigraph_source: "Who said it"
# moved_from: [old-slug]   # only after renaming this file's slug, so old links keep working
---
One or two paragraphs that say why this chapter matters and what the reader will be able to do after it.

![[NN_drawing-name.excalidraw|What this diagram shows, in one sentence]]

# First big idea

Explain it. Headings with one # become section 1, 2, 3… of the chapter (shown as 2.1, 2.2 …).

## A detail of the first idea

Headings with ## become 2.1.1, 2.1.2 … A footnote appears in the margin beside its line.[^1]

> [!note]
> A callout for something the reader shouldn't miss.

Inline math such as $\frac{1}{10^3}$, or a formula on its own line:

$$
\text{latency} \approx \frac{\text{distance}}{\text{speed of light}}
$$

# Second big idea

See [[chapter-1_computer-architecture|Chapter 1]] for the parts of a computer.

[^1]: The note's text. Keep it short; it sits next to the paragraph on wide screens.
