/**
 * Forked and modified from https://github.com/markdown-it/markdown-it-container/blob/master/index.mjs
 */

import type { Options, PluginWithOptions } from "markdown-it";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";

import type { MarkdownItContainerOptions } from "./options.js";

export const container: PluginWithOptions<MarkdownItContainerOptions> = (
  md,
  {
    name,
    marker = ":",
    validate = (params: string): boolean =>
      params.trim().split(" ", 2)[0] === name,
    openRender = (
      tokens: Token[],
      index: number,
      options: Options,
      _env: unknown,
      slf: Renderer,
    ): string => {
      // add a class to the opening tag
      tokens[index].attrJoin("class", name);

      return slf.renderToken(tokens, index, options);
    },
    closeRender = (
      tokens: Token[],
      index: number,
      options: Options,
      _env: unknown,
      slf: Renderer,
    ): string => slf.renderToken(tokens, index, options),
  } = { name: "" },
) => {
  const MIN_MARKER_NUM = 3;
  const markerStart = marker[0];
  const markerLength = marker.length;

  const container: RuleBlock = (state, startLine, endLine, silent) => {
    let start = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];

    // Check out the first character quickly,
    // this should filter out most of non-containers
    //
    if (markerStart !== state.src[start]) return false;

    let pos = start + 1;

    // Check out the rest of the marker string
    while (pos <= max) {
      if (marker[(pos - start) % markerLength] !== state.src[pos]) break;
      pos++;
    }

    const markerCount = Math.floor((pos - start) / markerLength);

    if (markerCount < MIN_MARKER_NUM) return false;

    pos -= (pos - start) % markerLength;

    const markup = state.src.slice(start, pos);
    const params = state.src.slice(pos, max);

    const validateRes = validate(params, markup);

    if (!validateRes) return false;

    // Since start is found, we can report success here in validation mode
    if (silent) return true;

    let nextLine = startLine;
    let autoClosed = false;

    // Search for the end of the block
    while (
      // unclosed block should be auto closed by end of document.
      // also block seems to be auto closed by end of parent
      nextLine < endLine
    ) {
      nextLine++;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent)
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;

      if (
        // match start
        markerStart === state.src[start] &&
        // closing fence should be indented less than 4 spaces
        state.sCount[nextLine] - state.blkIndent < 4
      ) {
        // check rest of marker
        for (pos = start + 1; pos <= max; pos++)
          if (marker[(pos - start) % markerLength] !== state.src[pos]) break;

        // closing code fence must be at least as long as the opening one
        if (Math.floor((pos - start) / markerLength) >= markerCount) {
          // make sure tail has spaces only
          pos -= (pos - start) % markerLength;
          pos = state.skipSpaces(pos);

          if (pos >= max) {
            // found!
            autoClosed = true;
            break;
          }
        }
      }
    }

    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;

    // @ts-expect-error: We are creating a new type called "container"
    state.parentType = "container";

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = nextLine;

    const openToken = state.push(`container_${name}_open`, "div", 1);

    openToken.markup = markup;
    openToken.block = true;
    openToken.info = params;
    openToken.map = [startLine, nextLine];

    if (typeof validateRes === "object") {
      const { inlineContent, attrs } = validateRes;
      let { headerTokenType, tag } = validateRes;

      if (attrs) {
        openToken.attrs = attrs;
      }

      if (inlineContent) {
        headerTokenType = headerTokenType || "container_header";
        tag = tag || "header";

        const openHeaderToken = state.push(`${headerTokenType}_open`, tag, 1);

        openHeaderToken.map = [startLine, state.line];
        openHeaderToken.children = [];

        const inlineContentToken = state.push("inline", "", 0);

        inlineContentToken.content = inlineContent;
        inlineContentToken.map = [startLine, state.line];
        inlineContentToken.children = [];

        state.push(`${headerTokenType}_close`, tag, -1);
      }
    }

    state.md.block.tokenize(state, startLine + 1, nextLine);

    const closeToken = state.push(`container_${name}_close`, "div", -1);

    closeToken.markup = state.src.slice(start, pos);
    closeToken.block = true;

    state.parentType = oldParent;
    state.lineMax = oldLineMax;
    state.line = nextLine + (autoClosed ? 1 : 0);

    return true;
  };

  md.block.ruler.before("fence", `container_${name}`, container, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules[`container_${name}_open`] = openRender;
  md.renderer.rules[`container_${name}_close`] = closeRender;
};
