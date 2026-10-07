<template>
    <NScrollbar
        v-if="!disableInternalScroll"
        style="height: 100%; max-height: 100%"
        :bordered="false"
    >
        <div
            ref="markdownContainer"
            class="markdown-content markdown-content--scrollable"
        ></div>
    </NScrollbar>
    <div
        v-else
        ref="markdownContainer"
        class="markdown-content"
        style="height: 100%; max-height: 100%; overflow-y: auto"
    ></div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { NScrollbar } from "naive-ui";

import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const props = defineProps({
    content: {
        type: String,
        default: "",
    },
    // New: streaming mode flag, used to optimize streaming rendering performance
    streaming: {
        type: Boolean,
        default: false,
    },
    // New: disable internal scrolling to avoid conflicts with the outer scrolling
    disableInternalScroll: {
        type: Boolean,
        default: false,
    },
});

const markdownContainer = ref(null);
const renderError = ref(null);

// General debounce function
const debounce = (fn, delay) => {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

// Unified error handling
const handleError = (error, context = "") => {
    console.error(`Markdown ${context} error:`, error);
    renderError.value = error.message;
    return ""; // Return an empty string as the default value
};

// Create the markdown-it instance and configure plugins
const md = new MarkdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        if (!lang || !hljs.getLanguage(lang)) return str;

        try {
            return hljs.highlight(str, { language: lang }).value;
        } catch (error) {
            handleError(error, "syntax highlighting");
            return str;
        }
    },
});

// Preprocess the Markdown content, removing extra blank lines
const removeExtraEmptyLines = (content) => {
    if (!content) return "";
    return content.replace(/\n\s*\n\s*(\n\s*)+/g, "\n\n");
};

// Efficient implementation for adding language labels to code blocks
const addLanguageLabels = () => {
    if (!markdownContainer.value) return;

    try {
        // Batch operations to avoid frequent reflows
        const preElements = markdownContainer.value.querySelectorAll("pre");
        if (!preElements.length) return;

        const processedPres = new Set();

        preElements.forEach((pre) => {
            // If already processed, skip
            if (processedPres.has(pre)) return;
            processedPres.add(pre);

            // Find the code element and the language class
            const codeEl = pre.querySelector("code");
            if (!codeEl || !codeEl.className) return;

            const langMatch = codeEl.className.match(/language-(\w+)/);
            if (!langMatch || !langMatch[1]) return;

            // If the pre is already inside a pre-wrapper, only update the label content
            if (pre.parentNode.classList.contains("pre-wrapper")) {
                const existingLabel = pre.parentNode.querySelector(
                    ".code-language-label",
                );
                if (existingLabel) {
                    existingLabel.textContent = langMatch[1];
                }
                return;
            }

            // Create the wrapper container and label
            const wrapper = document.createElement("div");
            wrapper.className = "pre-wrapper";

            const label = document.createElement("div");
            label.className = "code-language-label";
            label.textContent = langMatch[1];

            // Get the parent element and position of the pre
            const parent = pre.parentNode;
            const nextSibling = pre.nextSibling;

            // Build the DOM structure
            wrapper.appendChild(label);
            wrapper.appendChild(pre.cloneNode(true));

            // Replace the original pre
            if (nextSibling) {
                parent.insertBefore(wrapper, nextSibling);
            } else {
                parent.appendChild(wrapper);
            }

            // Remove the original pre (since we have cloned it and added it to the wrapper)
            parent.removeChild(pre);
        });
    } catch (error) {
        handleError(error, "language label processing");
    }
};

// Optimized HTML processing function
const processHTML = (html) => {
    if (!html) return "";

    try {
        // Extract the code blocks and save them first to avoid processing them
        const codeBlocks = [];
        let processedHtml = html.replace(
            /<pre\b[^>]*>([\s\S]*?)<\/pre>/g,
            (match) => {
                const id = `CODE_BLOCK_${codeBlocks.length}`;
                codeBlocks.push(match);
                return id;
            },
        );

        // Process the HTML of the non-code-block parts
        const parser = new DOMParser();
        const doc = parser.parseFromString(processedHtml, "text/html");

        // Determine whether parsing succeeded
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
            throw new Error("HTML parsing error");
        }

        const fragment = doc.body;

        // Function for removing empty nodes - unchanged
        const processNode = (node) => {
            const preserveElements = ["HR", "BR"];
            if (
                node.nodeType !== Node.ELEMENT_NODE ||
                preserveElements.includes(node.tagName)
            ) {
                return;
            }

            const children = Array.from(node.childNodes);

            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];

                if (child.nodeType === Node.TEXT_NODE) {
                    if (!child.textContent.trim()) {
                        node.removeChild(child);
                    } else {
                        child.textContent = child.textContent.replace(
                            /\s{2,}/g,
                            " ",
                        );
                    }
                    continue;
                }

                if (child.nodeType === Node.ELEMENT_NODE) {
                    processNode(child);

                    if (
                        child.tagName === "P" &&
                        !child.textContent.trim() &&
                        !child.querySelector("img, br")
                    ) {
                        node.removeChild(child);
                    }
                }
            }
        };

        // Process the whole document
        processNode(fragment);

        // Get the processed HTML
        processedHtml = fragment.innerHTML;

        // Put the code blocks back in place
        codeBlocks.forEach((block, i) => {
            processedHtml = processedHtml.replace(`CODE_BLOCK_${i}`, block);
        });

        return processedHtml;
    } catch (error) {
        return handleError(error, "HTML processing");
    }
};

// Render the Markdown content
const renderMarkdown = () => {
    renderError.value = null;

    if (!props.content) {
        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = "";
        }
        return;
    }

    try {
        // Preprocess the content
        const processedContent = removeExtraEmptyLines(props.content);

        // Use markdown-it to convert the Markdown to HTML
        const rawHtml = md.render(processedContent);

        // Process the HTML
        const processedHtml = processHTML(rawHtml);

        // Use DOMPurify to sanitize the HTML
        const cleanHtml = DOMPurify.sanitize(processedHtml);

        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = cleanHtml;

            // Use requestAnimationFrame to improve rendering performance
            requestAnimationFrame(() => {
                addLanguageLabels();
            });
        }
    } catch (error) {
        handleError(error, "rendering");
        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = `<p class="text-red-500">Error rendering markdown: ${renderError.value}</p>`;
        }
    }
};

// Use debouncing to handle content changes, optimized for streaming scenarios
const debouncedRenderMarkdown = debounce(renderMarkdown, 10); // Reduced from 50ms to 10ms
const streamingRenderMarkdown = debounce(renderMarkdown, 5); // Streaming mode uses a shorter delay

// Re-render when content changes
watch(
    () => props.content,
    (newContent) => {
        if (!newContent || newContent.trim() === "") {
            // For empty content, render immediately without debouncing
            renderMarkdown();
            return;
        }

        // Choose a different rendering strategy depending on whether it is in streaming mode
        if (props.streaming) {
            // Streaming mode: use a shorter debounce delay for a faster response
            streamingRenderMarkdown();
        } else {
            // Normal mode: use the standard debounce
            debouncedRenderMarkdown();
        }
    },
    { immediate: true },
);

// Render when the component mounts
onMounted(renderMarkdown);
</script>

<style>
/* Basic layout and non-color styles */
.markdown-content {
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    /* Pure Naive UI theme - remove custom CSS variables */
    padding: 0.75rem; /* Provide suitable padding, consistent with other components */
}

/* When NScrollbar is used, no scrollbar of its own is needed */
.markdown-content--scrollable {
    /* Hide the scrollbar but keep it scrollable */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* Hide the Webkit scrollbar */
.markdown-content::-webkit-scrollbar {
    display: none;
}

/* Remove the top margin of the first child to avoid blank space at the top */
.markdown-content > *:first-child {
    margin-top: 0 !important;
}

/* Remove the bottom margin of the last child to keep the bottom aligned */
.markdown-content > *:last-child {
    margin-bottom: 0 !important;
}

/* Use CSS variables to make theme switching easy */
:root {
    --md-title-spacing: 1em 0;
    --md-spacing-sm: 0.3em 0;
    --md-spacing-md: 0.5em 0;
    --md-spacing-lg: 0.8em 0;
}

/* Heading style optimization - uses theme colors */
.markdown-content h1 {
    line-height: 1.5;
    font-size: 1.6em;
    margin: var(--md-title-spacing);
    font-weight: 600;
    color: inherit;
}

.markdown-content h2 {
    line-height: 1.5;
    font-size: 1.4em;
    margin: var(--md-spacing-lg);
    font-weight: 600;
    padding-bottom: 0.1em;
    color: inherit;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.markdown-content h3 {
    line-height: 1.5;
    font-size: 1.2em;
    margin: var(--md-spacing-md);
    font-weight: 600;
    color: inherit;
}

.markdown-content h4 {
    line-height: 1.5;
    font-size: 1em;
    margin: var(--md-spacing-sm);
    font-weight: 600;
    color: inherit;
}

/* Paragraph styles */
.markdown-content p {
    line-height: 1.6;
    margin: var(--md-spacing-sm);
    white-space: pre-wrap;
    color: inherit;
}

/* List styles */
.markdown-content ul,
.markdown-content ol {
    padding-left: 1.5em;
    margin: var(--md-spacing-sm);
    line-height: 1.5;
    color: inherit;
}

/* Make list items compact */
.markdown-content li {
    line-height: 1.5;
    margin: var(--md-spacing-sm);
    color: inherit;
}

/* Nested list optimization */
.markdown-content li > ul,
.markdown-content li > ol {
    margin-top: 0;
    margin-bottom: 0;
}

/* Code block styles */
.markdown-content pre {
    border-radius: 6px;
    padding: 0.5em;
    overflow: auto;
    margin-bottom: 0.1em;
    position: relative;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.1);
    /* Add scrollbar styles */
    scrollbar-width: thin; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* Webkit scrollbar styles */
.markdown-content pre::-webkit-scrollbar {
    height: 3px;
}

.markdown-content pre::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
}

.pre-wrapper {
    position: relative;
}

.pre-wrapper .code-language-label {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    /* Other styles stay unchanged */
}
.code-language-label {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0.2em 0.5em;
    font-size: 0.75em;
    font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    border-bottom-left-radius: 4px;
    user-select: none;
    background-color: #18a058;
    color: white;
}

.markdown-content code {
    font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.85em;
    padding: 0.1em;
    margin: 0.3em;
    border-radius: 6px;
    white-space: pre;
    background-color: rgba(0, 0, 0, 0.02);
    color: inherit;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Blockquote styles */
.markdown-content blockquote {
    padding: 0.1em 0.5em;
    margin: var(--md-spacing-sm);
    border-left-width: 0.25em;
    border-left-style: solid;
    border-left-color: #18a058;
    background-color: rgba(0, 0, 0, 0.02);
    color: inherit;
}

/* Table styles */
.markdown-content table {
    border-collapse: collapse;
    width: 100%;
    margin: var(--md-spacing-sm);
    overflow: auto;
    font-size: 0.9em;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.markdown-content table th,
.markdown-content table td {
    line-height: 1.5;
    padding: 0.3em 0.5em;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: inherit;
}

.markdown-content table th {
    background-color: rgba(0, 0, 0, 0.02);
    font-weight: 600;
}

/* Responsive tables */
@media (max-width: 600px) {
    .markdown-content table {
        display: block;
        overflow-x: auto;
    }
}

/* Image styles */
.markdown-content img {
    max-width: 100%;
    height: auto; /* Make sure the aspect ratio is kept */
    box-sizing: border-box;
    margin: var(--md-spacing-sm);
    /* Add a display effect while the image is loading */
    opacity: 1;
    transition: opacity 0.3s ease;
}

.markdown-content img:not([src]) {
    opacity: 0.5;
}

/* Horizontal rule styles */
.markdown-content hr {
    height: 0.25em;
    border: 1;
    margin: 1em 0;
}

/* Link styles */
.markdown-content a {
    text-decoration: none;
    transition: color 0.2s ease; /* Smooth color change */
    color: #18a058;
}

.markdown-content a:hover {
    text-decoration: underline;
    opacity: 0.8;
}
</style>
