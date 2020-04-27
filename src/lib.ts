import { readFileSync } from 'fs'
import { minify } from 'html-minifier-terser'
import { JSDOM } from 'jsdom'
import * as litHtml from 'nlit-html'
import { join } from 'path'

const { window } = new JSDOM(`<!DOCTYPE html>`, { runScripts: 'dangerously' })
const myLibrary = readFileSync(join(__dirname, 'base.bundle.js'), { encoding: 'utf-8' })

const scriptEl = window.document.createElement('script')
scriptEl.textContent = myLibrary
window.document.body.appendChild(scriptEl)

type nlithtml = typeof litHtml & { render(result: litHtml.TemplateResult, options?: Partial<litHtml.RenderOptions>): string }

const lib: nlithtml = window['litHtmlLib']

Object.assign(exports, lib)

export function render(result: litHtml.TemplateResult, options?: Partial<litHtml.RenderOptions>): string {
    return minify(lib.render(result, options), {
        decodeEntities: true,
        collapseBooleanAttributes: true,
        preserveLineBreaks: true,
        removeComments: true
    })
}
