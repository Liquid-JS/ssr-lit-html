import { minify } from 'html-minifier';
import { JSDOM } from 'jsdom';
import { RenderOptions, TemplateResult } from 'nlit-html';

const dom = new JSDOM(`<!DOCTYPE html>`);
global['window'] = dom.window;
global['document'] = dom.window.document;
const { render: orgRender } = require('nlit-html');

export * from 'nlit-html';

export function render(result: TemplateResult, options?: Partial<RenderOptions>): string {
    const div = new JSDOM(`<!DOCTYPE html><div id="dd"></div>`).window.document.getElementById('dd') as Element;
    orgRender(result, div, options);
    return minify(div.innerHTML, {
        decodeEntities: true,
        collapseBooleanAttributes: true,
        preserveLineBreaks: true,
        removeComments: true
    });
}