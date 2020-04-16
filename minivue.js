function MiniVue(options) {
    let evalInContext = function (code, arguments) {
        arguments = arguments || {};
        with (this) {
            with (arguments) {
                return eval(code);
            }
        }
    }.bind(this);

    let evaluateProperty = function (key, value) {
        const prefix = key.slice(0, key.indexOf(":") + 1) || (key[0] === "@" ? "@" : "");
        key = key.slice(prefix.length);
        if (prefix === "v-bind:" || prefix === ":" || key === "v-if") {
            value = evalInContext(value);
        } else if (prefix === "v-on:" || prefix === "@") {
            key = "on" + key;
            let code = value;  // otherwise value will remain the last
            value = (event) => evalInContext(code, { $event: event });
        }
        return [key, value];
    };

    this.buildVirtualElement = function (domNode, parentElement) {
        if (domNode.nodeType == Node.ELEMENT_NODE) {
            let element = {
                tag: domNode.tagName,
                attrs: {},
                children: [],
            };
            for (let attr of domNode.attributes) {
                const [key, value] = evaluateProperty(attr.name, attr.value)
                element.attrs[key] = value;
                if (key === "v-if" && !value) {
                    return null;
                }
            }
            for (let child of domNode.childNodes) {
                const childElement = this.buildVirtualElement(child);
                // might be removed if v-if == false
                if (childElement) {
                    element["children"].push(childElement);
                }
            }
            return element;
        } else if (domNode.nodeType == Node.TEXT_NODE) {
            return { tag: "TEXT", text: domNode.wholeText, children: [] };
        }
    };

    this.reconcile = function (element, instance) {
        if (element.tag === "TEXT" || instance.element.tag !== element.tag) {
            instance.element = element;
            newInstance = this.instantiate(element);
            instance.element = newInstance.element;
            instance.dom.replaceWith(newInstance.dom);
            instance.dom = newInstance.dom;
        } else {
            updateDomProperties(element, instance.dom);
        }
        for (var i = 0; i < element.children.length; i++) {
            this.reconcile(element.children[i], instance.children[i]);
        }
    };

    let updateDomProperties = function (element, dom) {
        for (let key in element.attrs) {
            dom[key] = element.attrs[key]; 
        }
    };

    this.instantiate = function (element) {
        let instance = { element: element, dom: null, children: [] };
        if (element.tag !== "TEXT") {
            const dom = document.createElement(element.tag);
            updateDomProperties(element, dom);
            for (let child of element.children) {
                const childInstance = this.instantiate(child);
                instance.children.push(childInstance);
                dom.appendChild(childInstance.dom);
            }
            instance.dom = dom;
        } else {
            const pattern = /\{\{([^\}]+?)\}\}/g;
            const expressions = element.text.match(pattern) || [];
            for (let expression of expressions) {
                const unwrapped = expression.replace(pattern, "$1");
                const value = evalInContext(unwrapped);
                element.text = element.text.split(expression).join(value); // replace expression with value
            }
            instance.dom = document.createTextNode(element.text);
        }
        return instance;
    };

    const data = options.data || {};
    for (let key in data) {
        Object.defineProperty(this, key, {
            get() {
                return data[key];
            },
            set(value) {
                data[key] = value;
                // this.updateDOM();
                let virtualDOM = this.buildVirtualElement(this.template);
                this.reconcile(virtualDOM, currentInstance);
            },
        });
    }

    const methods = options.methods || {};
    this.methods = {};
    for (let key in methods) {
        this[key] = methods[key];
    }

    this.updateDOM = function () {
        const virtualDOM = this.buildVirtualElement(this.template);
        currentInstance = this.instantiate(virtualDOM);
        this.reconcile(virtualDOM, currentInstance);
    };

    let container = document.querySelector(options["el"]);
    this.template = container.cloneNode(true);
    let currentInstance;
    this.updateDOM();
    container.replaceWith(currentInstance.dom);
    container = currentInstance.dom;
    if (options.mounted) {
        options.mounted.bind(this)();
    }
}
