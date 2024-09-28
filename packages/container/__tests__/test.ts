import MarkdownIt from "markdown-it";

import { container } from "../src/index.js";

const markdownIt = MarkdownIt({ linkify: true }).use(container, {
  name: "name",
  validate: (params) => {
    params = params.trim();
    const found = /^name\s+\[(.*)\]\s*$/.exec(params);

    const validateRes = found ? { inlineContent: found[1] } : false;

    return validateRes;
  },
});

// markdownIt.renderer.rules["container_header_open"]  = function () { console.log('*****************'); return '<b>'; };

const html = markdownIt.render("::: name [**Inline** content]\nfoo\n:::\n");

console.log(html);
