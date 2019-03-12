import { render as orgRender, RenderOptions, TemplateResult } from 'nlit-html'
import { marker } from 'nlit-html/lib/template'

interface TemplateDivCache {
    stringsArray: WeakMap<TemplateStringsArray, HTMLDivElement>
    keyString: Map<string, HTMLDivElement>
}

const templateDivCaches = new Map<string, TemplateDivCache>()

function templateDivFactory(result: TemplateResult): HTMLDivElement {
    let templateCache = templateDivCaches.get(result.type)
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap<TemplateStringsArray, HTMLDivElement>(),
            keyString: new Map<string, HTMLDivElement>()
        }
        templateDivCaches.set(result.type, templateCache)
    }

    let template = templateCache.stringsArray.get(result.strings)
    if (template !== undefined) {
        return template
    }

    const key = result.strings.join(marker)

    template = templateCache.keyString.get(key)
    if (template === undefined) {
        template = document.createElement('div')
        templateCache.keyString.set(key, template)
    }

    templateCache.stringsArray.set(result.strings, template)
    return template
}

import * as litHtml from 'nlit-html'

function render(result: TemplateResult, options?: Partial<RenderOptions>): string {
    const div = templateDivFactory(result)
    orgRender(result, div, options)
    return div.innerHTML
}

window['litHtmlLib'] = {
    ...litHtml,
    render
}
