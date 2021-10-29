import { marker, render as orgRender, RenderOptions, TemplateResult } from 'nlit-html'

interface TemplateDivCache {
    stringsArray: WeakMap<TemplateStringsArray, HTMLDivElement>
    keyString: Map<string, HTMLDivElement>
}

const templateDivCaches = new Map<number, TemplateDivCache>()

function templateDivFactory(result: TemplateResult): HTMLDivElement {
    let templateCache = templateDivCaches.get(result['_$litType$'])
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap<TemplateStringsArray, HTMLDivElement>(),
            keyString: new Map<string, HTMLDivElement>()
        }
        templateDivCaches.set(result['_$litType$'], templateCache)
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
import * as directive from 'nlit-html/directive'
import * as directiveHelpers from 'nlit-html/directive-helpers'
import { asyncAppend } from 'nlit-html/directives/async-append'
import { asyncReplace } from 'nlit-html/directives/async-replace'
import { cache } from 'nlit-html/directives/cache'
import { classMap } from 'nlit-html/directives/class-map'
import { guard } from 'nlit-html/directives/guard'
import { ifDefined } from 'nlit-html/directives/if-defined'
import { repeat } from 'nlit-html/directives/repeat'
import { styleMap } from 'nlit-html/directives/style-map'
import { unsafeHTML } from 'nlit-html/directives/unsafe-html'
import { until } from 'nlit-html/directives/until'

function render(result: TemplateResult, options?: Partial<RenderOptions>): string {
    const div = templateDivFactory(result)
    orgRender(result, div, options)
    return div.innerHTML
}

window['litHtmlLib'] = {
    ...litHtml,
    directive,
    directiveHelpers,
    asyncAppend,
    asyncReplace,
    cache,
    classMap,
    guard,
    ifDefined,
    repeat,
    styleMap,
    unsafeHTML,
    until,
    render
}
