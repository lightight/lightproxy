"use strict";
/**
 * Processes input to return a valid URL.
 * @param {string} input - User input
 * @param {string} template - Search engine template (e.g., 'https://google.com/search?q=%s')
 * @returns {string} Fully qualified URL
 */
function search(input, template) {
    try {
        // 1. Check if input is already a valid URL (e.g. "https://example.com")
        return new URL(input).toString();
    } catch (err) {}

    try {
        // 2. Check if input is a domain (e.g. "example.com")
        const url = new URL(`http://${input}`);
        if (url.hostname.includes(".")) return url.toString();
    } catch (err) {}

    // 3. Treat as search query
    return template.replace("%s", encodeURIComponent(input));
}