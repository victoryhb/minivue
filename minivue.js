function MiniVue(options) {
    let evalInContext = function (code, arguments) {
        arguments = arguments || {};
        with (this) {
            with (arguments) {
                return eval(code);
            }
        }
    }.bind(this);

    this.buildVirtualDOM = function (node) {
        if (node.nodeType == Node.ELEMENT_NODE) {
            let currentNode = {
                tag: node.tagName,
                attrs: {},
                children: [],
            };
            for (let attr of node.attributes) {
                currentNode.attrs[attr.name] = attr.value;
            }
            for (let child of node.childNodes) {
                const childNode = this.buildVirtualDOM(child);
                currentNode["children"].push(childNode);
            }
            return currentNode;
        } else if (node.nodeType == Node.TEXT_NODE) {
            return node.wholeText;
        }
    };

    this.renderVirtualDOM = function (node) {
        if (node.tag) {
            const element = document.createElement(node.tag);
            for (let key in node.attrs) {
                let val = node.attrs[key]; // 'let' avoids closure problems
                const prefix = key.slice(0, key.indexOf(":") + 1) || (key[0] === "@" ? "@" : "");
                if (prefix === "v-bind:" || prefix === ":") {
                    element[key.slice(prefix.length)] = evalInContext(val);
                } else if (prefix === "v-on:" || prefix === "@") {
                    element.addEventListener(key.slice(prefix.length), (event) =>
                        evalInContext(val, { $event: event })
                    );
                } else {
                    element[key] = val;
                }
            }
            for (let child of node.children) {
                const childElement = this.renderVirtualDOM(child);
                element.appendChild(childElement);
            }
            return element;
        } else if (typeof node === "string") {
            const pattern = /\{\{([^\}]+?)\}\}/g;
            const expressions = node.match(pattern) || [];
            for (let expression of expressions) {
                const unwrapped = expression.replace(pattern, "$1");
                const value = evalInContext(unwrapped);
                node = node.split(expression).join(value); // replace expression with value
            }
            return document.createTextNode(node);
        }
    };

    const data = options.data || {};
    for (let key in data) {
        Object.defineProperty(this, key, {
            get() {
                return data[key];
            },
            set(value) {
                data[key] = value;
                this.updateDOM();
            },
        });
    }

    const methods = options.methods || {};
    this.methods = {};
    for (let key in methods) {
        this[key] = methods[key];
    }

    let container = document.querySelector(options["el"]);
    this.template = container.cloneNode(true);
    this.updateDOM = function () {
        const virtualDOM = this.buildVirtualDOM(this.template);
        const renderedElement = this.renderVirtualDOM(virtualDOM);
        container.replaceWith(renderedElement);
        container = renderedElement;
    };
    this.updateDOM();
    if (options.mounted) {
        options.mounted.bind(this)();
    }
}
