import { TemplateResult, SVGTemplateResult, templateCaches, TemplatePart, marker, markerRegex, lastAttributeNameRegex, TemplateFactory, Part, SinglePart, MultiPart, TemplateInstance, AttributePart, getValue, directiveValue, isPrimitiveValue } from 'nlit-html';
import { parse, parseFragment, AST, serialize } from 'parse5/lib';

export interface ISsrTemplateResult {
    getSsrTemplateElement(): AST.DocumentFragment;
}

export interface ITemplateResult extends TemplateResult, ISsrTemplateResult { }

export class SsrTemplateResult extends TemplateResult implements ISsrTemplateResult {
    getSsrTemplateElement(): AST.DocumentFragment {
        const htmlCont = this.getHTML();
        if (htmlCont.trim().toUpperCase().startsWith('<!DOCTYPE') ||
            htmlCont.trim().toUpperCase().startsWith('<HTML'))
            return parse(htmlCont);

        return parseFragment(htmlCont);
    }
}

export class SsrSVGTemplateResult extends SVGTemplateResult implements ISsrTemplateResult {
    getSsrTemplateElement(): AST.DocumentFragment {
        return (<AST.Default.DocumentFragment>parseFragment(this.getHTML())).childNodes[0];
    }
}

export const html = (strings: TemplateStringsArray, ...values: any[]) =>
    new SsrTemplateResult(strings, values, 'html', defaultPartCallback);

export const svg = (strings: TemplateStringsArray, ...values: any[]) =>
    new SsrSVGTemplateResult(strings, values, 'svg', defaultPartCallback);

export function defaultTemplateFactory(result: ITemplateResult) {
    let templateCache: Map<TemplateStringsArray, Template> = <any>templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = new Map<TemplateStringsArray, Template>();
        templateCaches.set(result.type, <any>templateCache);
    }
    let template = templateCache.get(result.strings);
    if (template === undefined) {
        template = new Template(result, result.getSsrTemplateElement());
        templateCache.set(result.strings, template);
    }
    return template;
}

function recursiveWalker(node: AST.DocumentFragment | AST.Default.Element, cb: (node: AST.Default.Element | AST.Default.Node) => void) {
    if (node) {
        cb(<any>node);
        if ('childNodes' in node && Array.isArray(node.childNodes)) {
            const children: any[] = node.childNodes;
            children.forEach((el) => recursiveWalker(el, cb));
        }
    }
}

export class Template {
    parts: TemplatePart[] = [];
    element: AST.DocumentFragment;

    constructor(result: ITemplateResult, element: AST.DocumentFragment) {
        this.element = element;

        let index = -1;
        let partIndex = 0;

        recursiveWalker(element, (orNode) => {
            index++;
            if ('attrs' in orNode) {
                const node = <AST.Default.Element>orNode;
                const attributes = node.attrs || [];
                // Per https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                // attributes are not guaranteed to be returned in document order. In
                // particular, Edge/IE can return them out of order, so we cannot assume
                // a correspondance between part index and attribute index.
                let count = 0;
                for (let i = 0; i < attributes.length; i++) {
                    if (attributes[i].value.indexOf(marker) >= 0) {
                        count++;
                    }
                }
                while (count-- > 0) {
                    // Get the template literal section leading up to the first
                    // expression in this attribute attribute
                    const stringForPart = result.strings[partIndex];
                    // Find the attribute name
                    const attributeNameInPart =
                        lastAttributeNameRegex.exec(stringForPart)![1];

                    // Find the corresponding attribute
                    const attribute = attributes.find((attr) => attr.name === attributeNameInPart);
                    if (attribute) {
                        const stringsForAttributeValue = attribute.value.split(markerRegex);
                        this.parts.push(new TemplatePart(
                            'attribute',
                            index,
                            attribute.name,
                            attributeNameInPart,
                            stringsForAttributeValue));
                        node.attrs = node.attrs.filter((attr) => attr !== attribute);
                        partIndex += stringsForAttributeValue.length - 1;
                    }
                }
            } else if (orNode && orNode.nodeName === '#comment') {
                const node = <AST.Default.CommentNode>orNode;
                if (node.data && node.data === marker) {
                    this.parts.push(new TemplatePart('node', index));
                    const tNode = <AST.Default.TextNode>orNode;
                    tNode.nodeName = '#text';
                    tNode.value = '';
                    Object.keys(tNode)
                        .filter((key) => key !== 'nodeName' && key !== 'value' && key !== 'parentNode')
                        //@ts-ignore
                        .forEach((key) => delete tNode[key]);

                    partIndex++;
                }
            }
        });
    }
}

export type PartCallback =
    (instance: SsrTemplateInstance, templatePart: TemplatePart, node: AST.Default.Element | AST.Default.Node) =>
        Part;

const CircularJSON = require('circular-json-es6');

export class SsrTemplateInstance {
    _parts: Part[] = [];
    _partCallback: PartCallback;
    _getTemplate: TemplateFactory;
    template: Template;

    constructor(
        template: Template, partCallback: PartCallback,
        getTemplate: TemplateFactory) {
        this.template = template;
        this._partCallback = partCallback;
        this._getTemplate = getTemplate;
    }

    update(values: any[]) {
        let valueIndex = 0;
        for (const part of this._parts) {
            if (part.size === undefined) {
                (part as SinglePart).setValue(values[valueIndex]);
                valueIndex++;
            } else {
                (part as MultiPart).setValue(values, valueIndex);
                valueIndex += part.size;
            }
        }
    }

    _clone(): AST.Default.DocumentFragment {
        const fragment = CircularJSON.parse(CircularJSON.stringify(this.template.element));
        const parts = this.template.parts;

        if (parts.length > 0) {
            // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be
            // null

            let index = -1;
            let i = 0;
            let part = parts[i];
            recursiveWalker(fragment, (orNode) => {
                index++;
                while (part && index === part.index) {
                    this._parts.push(this._partCallback(this, part, orNode));
                    i++;
                    part = parts[i];
                }
            });
        }
        return fragment;
    }
}

// const instances = new Map();

export type ChildNode = { parentNode: AST.Default.ParentNode } & AST.Default.Node;

function nextNode(node: ChildNode): ChildNode {
    if (!node || !node.parentNode)
        return null!;
    return <ChildNode>node.parentNode.childNodes.find((_el, i) => i > 0 && node.parentNode.childNodes[i - 1] === node);
}

function prevNode(node: ChildNode): ChildNode {
    if (!node || !node.parentNode)
        return null!;
    return <ChildNode>node.parentNode.childNodes.find((_el, i) => i < node.parentNode.childNodes.length - 1 && node.parentNode.childNodes[i + 1] === node);
}

export class SsrNodePart implements SinglePart {
    instance: TemplateInstance;
    startNode: ChildNode;
    endNode: ChildNode;
    _previousValue: any;

    constructor(instance: TemplateInstance, startNode: ChildNode, endNode: ChildNode) {
        this.instance = instance;
        this.startNode = startNode;
        this.endNode = endNode;
        this._previousValue = undefined;
    }

    setValue(value: any): void {
        value = getValue(this, value);
        if (value === directiveValue) {
            return;
        }
        if (isPrimitiveValue(value)) {
            // Handle primitive values
            // If the value didn't change, do nothing
            if (value === this._previousValue) {
                return;
            }
            this._setText(value);
        } else if (value instanceof TemplateResult) {
            this._setTemplateResult(value);
        } else if (Array.isArray(value) || value[Symbol.iterator]) {
            this._setIterable(value);
        } else if ('nodeName' in value) {
            this._setNode(value);
        } else if (value.then !== undefined) {
            this._setPromise(value);
        } else {
            // Fallback, will render the string representation
            this._setText(value);
        }
    }

    _insert(node: ChildNode) {
        let i = this.endNode ? this.endNode.parentNode.childNodes.findIndex((el) => el === this.endNode) : -1;
        if (i < 0) {
            node.parentNode = this.startNode.parentNode;
            i = this.startNode.parentNode.childNodes.findIndex((el) => el === this.startNode);
            this.startNode.parentNode.childNodes.splice(i, 0, node);
            return;
        }

        node.parentNode = this.endNode.parentNode;

        if (i === 0)
            this.endNode.parentNode.childNodes.unshift(node);

        this.endNode.parentNode.childNodes.splice(i - 1, 0, node);
    }

    _setNode(value: ChildNode): void {
        if (this._previousValue === value) {
            return;
        }
        this.clear();
        this._insert(value);
        this._previousValue = value;
    }

    _setText(value: string): void {
        const node = nextNode(this.startNode);
        value = value === undefined ? '' : value;
        if (node === prevNode(this.endNode) && node.nodeName === '#text') {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if _previousValue is
            // primitive?
            const tNode = <AST.Default.TextNode>node;
            tNode.value = asStr(value);
        } else {
            this._setNode({ nodeName: '#text', value: asStr(value) } as AST.Default.TextNode);
        }
        this._previousValue = value;
    }

    _setTemplateResult(value: TemplateResult): void {
        const template = this.instance._getTemplate(value);
        let instance: SsrTemplateInstance;
        if (this._previousValue && this._previousValue.template === template) {
            instance = this._previousValue;
        } else {
            instance = new SsrTemplateInstance(
                template, <any>this.instance._partCallback, this.instance._getTemplate);
            this._setIterable(instance._clone().childNodes);
            this._previousValue = instance;
        }
        instance.update(value.values);
    }

    _setIterable(value: any): void {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.

        // If _previousValue is an array, then the previous render was of an
        // iterable and _previousValue will contain the NodeParts from the previous
        // render. If _previousValue is not an array, clear this part and make a new
        // array for NodeParts.

        if (!Array.isArray(this._previousValue)) {
            this.clear();
            this._previousValue = [];
        }

        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this._previousValue as any[];
        let partIndex = 0;

        for (const item of value) {
            // Try to reuse an existing part
            let itemPart = itemParts[partIndex];

            // If no existing part, create a new one
            if (itemPart === undefined) {
                // If we're creating the first item part, it's startNode should be the
                // container's startNode
                let itemStart = this.startNode;

                // If we're not creating the first part, create a new separator marker
                // node, and fix up the previous part's endNode to point to it
                if (partIndex > 0) {
                    const previousPart = itemParts[partIndex - 1];
                    itemStart = previousPart.endNode = { nodeName: '#text', value: '' } as AST.Default.TextNode;
                    this._insert(itemStart);
                }
                itemPart = new SsrNodePart(this.instance, itemStart, this.endNode);
                itemParts.push(itemPart);
            }
            itemPart.setValue(item);
            partIndex++;
        }

        if (partIndex === 0) {
            this.clear();
            this._previousValue = undefined;
        } else if (partIndex < itemParts.length) {
            const lastPart = itemParts[partIndex - 1];
            // Truncate the parts array so _previousValue reflects the current state
            itemParts.length = partIndex;
            this.clear(<ChildNode>prevNode(lastPart.endNode));
            lastPart.endNode = this.endNode;
        }
    }

    _setPromise(value: Promise<any>): void {
        this._previousValue = value;
        value.then((v: any) => {
            if (this._previousValue === value) {
                this.setValue(v);
            }
        });
    }

    clear(startNode: ChildNode = this.startNode) {
        removeNodes(
            this.startNode.parentNode!, <ChildNode>nextNode(startNode), this.endNode);
    }
}

/**
 * Removes nodes, starting from `startNode` (inclusive) to `endNode`
 * (exclusive), from `container`.
 */
export const removeNodes =
    (container: AST.Default.ParentNode, startNode: ChildNode | null, endNode: ChildNode | null = null):
        void => {
        let node = startNode;
        while (node !== endNode) {
            const n = nextNode(node!);
            if (n) {
                container.childNodes.filter((n) => n !== node);
                node = <ChildNode>n;
            } else {
                return;
            }
        }
    };

export class SsrAttributePart extends AttributePart {

    setValue(values: any[], startIndex: number): void {
        if (this._equalToPreviousValues(values, startIndex)) {
            return;
        }
        const s = this.strings;
        let value: any;
        if (s.length === 2 && s[0] === '' && s[1] === '') {
            // An expression that occupies the whole attribute value will leave
            // leading and trailing empty strings.
            value = getValue(this, values[startIndex]);
            if (Array.isArray(value)) {
                value = value.join('');
            }
        } else {
            value = this._interpolate(values, startIndex);
        }
        if (value !== directiveValue) {
            const el: AST.Default.Element = <any>this.element;
            if (!el.attrs.find((attr) => {
                if (attr.name === this.name) {
                    attr.value = asStr(value);
                    return true;
                }
                return false;
            }))
                el.attrs.push({ name: this.name, value: asStr(value) });
        }
        this._previousValues = values;
    }
}

function asStr(val: any): string {
    return ('' + (val || ''));
}

export const defaultPartCallback =
    (instance: TemplateInstance,
        templatePart: TemplatePart,
        node: Node): Part => {
        if (templatePart.type === 'attribute') {
            return new SsrAttributePart(
                instance, node as Element, templatePart.name!, templatePart.strings!
            );
        } else if (templatePart.type === 'node') {
            return new SsrNodePart(instance, <any>node, <ChildNode>nextNode(<any>node));
        }
        throw new Error(`Unknown part type ${templatePart.type}`);
    };

export function render(
    result: ITemplateResult,
    templateFactory: TemplateFactory = <any>defaultTemplateFactory) {
    const template = templateFactory(result);
    /*let instance = instances.get(defaultTemplateFactory);

    // Repeat render, just call update()
    if (instance !== undefined && instance.template === template &&
        instance._partCallback === result.partCallback) {
        instance.update(result.values);
        return;
    }*/

    // First render, create a new TemplateInstance and append it
    const instance =
        new SsrTemplateInstance(template, <any>result.partCallback, templateFactory);
    //instances.set(defaultTemplateFactory, instance);

    const fragment = instance._clone();
    instance.update(result.values);
    return serialize(fragment);
}
