export class ContextMenu {

    constructor(template: string, items: Object) {
        this.visible = false;
        this.x = 0;
        this.y = 0;
        this.items = items;
        
        this.$cd = alight.ChangeDetector();
        this.$cd.scope.contextMenu = this;
        this.dom = d3.select('body').append('div');
        this.dom.node().setAttribute('tabindex', 1);
     
        this.dom.on('blur', () => {
            var parent = d3.event.relatedTarget;
            var needHide = true;

            while (parent) {
                if (this.dom.node() === parent)
                    needHide = false;
                parent = parent.parentElement;
            }
            if (needHide)
                setTimeout(this.hide.bind(this), 100);
        });

        d3.text(template, (error, text) => {
            if (error) throw error;

            this.dom.html(text);
            alight.bind(this.$cd, this.dom.node());
        });
    }

    searchItems(filter: ?string) {
        var regex = new RegExp(filter, 'i'); 

        var items = Object.assign({}, this.items);

        Object.keys(items).forEach(key => {
            items[key] = Object.assign({}, items[key]);
        });

        Object.keys(items).forEach(itemKey => {
            var itemObj = items[itemKey];

            Object.keys(itemObj).forEach(subitem => {
                if (!regex.test(subitem))
                    delete itemObj[subitem];
            });

            if (Object.keys(itemObj).length === 0)
                delete items[itemKey];
        });

        return items;
    }

    onCilck(subitem) {
        throw new TypeError('onClick should be overrided');
    }

    isVisible() {
        return this.visible;
    }

    show(x: number, y: number) {
        this.visible = true;
        this.x = x;
        this.y = y;
        this.dom.node().focus();
        this.$cd.scan();
    }

    hide() {
        this.visible = false;
        this.$cd.scan();
    }
}