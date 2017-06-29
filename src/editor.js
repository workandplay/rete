import {ContextMenu} from './contextmenu';
import {Group} from './group';
import {Node} from './node';
import {Socket} from './socket';

export class NodeEditor {

    constructor(id, builders, event) {

        var self = this;
                
        this.event = event;
        this.active = null;
        this.nodes = [];
        this.groups = [];
        this.builders = builders;

        this.pickedOutput = null;
        this.dom = null;

        this.dom = document.getElementById(id);
        this.dom.tabIndex = 1;

        var nodeNames = builders.map(function (e) {
            return e.name;
        });

        this.contextMenu = new ContextMenu(nodeNames, this.addNode.bind(this));
        this.svg = d3.select(this.dom);

        this.clickable = this.svg.append('rect')
            .attr('fill', 'transparent')
            .on('click', this.areaClick.bind(this));

        this.x = d3.scaleLinear();
        this.y = d3.scaleLinear();

        this.view = this.svg.append('g');
       
        this.zoom = d3.zoom()
            .scaleExtent([0.2, 1.5])
            .on('zoom', function () {
                self.view.attr('transform', d3.event.transform);
            });

        this.svg.call(this.zoom);

        d3.select(window)
            .on('mousemove', function () { self.update();}) // update picked connection   
            .on('keydown.' + id, self.keyDown.bind(this))
            .on('resize.' + id, function () { self.resize();});
        
        self.$scope = alight.Scope();
        self.$scope.nodes = self.nodes;
        self.$scope.groups = self.groups;
        self.$scope.editor = self;

        self.declareDirectives();
        
        d3.text('view.html', function(error, text) {
            if (error) throw error;
            self.view.html(text);
            alight.applyBindings(self.$scope, self.view.node());
            self.resize(); 
        });
        
    }

    declareDirectives() {
        var self = this;

        alight.directives.al.dragableNode = function (scope, el, obj) {
            var node = scope.node;

            d3.select(el).call(d3.drag().on('start', function () {
                d3.select(this.parentNode).raise();
            }).on('drag', function () {
                node.position[0] += self.x.invert(d3.event.dx);
                node.position[1] += self.y.invert(d3.event.dy);
                self.update();
            }).on('end', function () {
                self.groups.forEach(group => {
                    var contain = group.containNode(node);
                    var cover = group.isCoverNode(node);
                    
                    if (contain && !cover)
                        group.removeNode(node);
                    else if (!contain && cover)
                        group.addNode(node);
                });
                self.update();
            }))
        };

        alight.directives.al.dragableGroup = function (scope, el, obj) {
            var group = scope.group;

            d3.select(el).call(d3.drag().on('drag', function () {
                group.position[0] += self.x.invert(d3.event.dx);
                group.position[1] += self.y.invert(d3.event.dy);

                for (var i in group.nodes) {
                    var node = group.nodes[i];

                    node.position[0] += self.x.invert(d3.event.dx);
                    node.position[1] += self.y.invert(d3.event.dy);
                }

                self.update();
            }));
        };

        alight.directives.al.dragableGroupHandler = function (scope, el, obj) {
            var group = scope.group;

            d3.select(el).call(d3.drag().on('drag', function () {
                d3.select(this)
                        .attr('cx', group.setWidth(group.width + self.x.invert(d3.event.dx)))
                        .attr('cy', group.setHeight(group.height + self.y.invert(d3.event.dy)));
                
                self.update();
            }).on('end', function () {
                self.nodes.forEach(node => {
                    if (group.isCoverNode(node))
                        group.addNode(node);
                    else
                        group.removeNode(node);
                        
                });
                self.update();
            }))
        };

        alight.directives.al.svgBack = function (scope, el, obj) {
            d3.select(el).lower();
            scope.$scan();
        }

        alight.directives.al.groupTitleClick = function (scope, el, obj) {
            var group = scope.group;

            d3.select(el).on('click', function () {
                var title = prompt('Please enter title of the group', group.title.text);

                group.title.text = title;
                scope.$scan();
            });
        };
        
        alight.directives.al.pickInput = function (scope, el, obj) {
            d3.select(el).on('mousedown', function () {
                var input = scope.input;

                if (self.pickedOutput === null) {
                    if (input.hasConnection()) {
                        self.pickedOutput = input.connection.output;
                        self.removeConnection(input.connection);
                    }
                    return;
                }
                    
                if (input.hasConnection())
                    self.removeConnection(input.connection);

                try {
                    var connection = self.pickedOutput.connectTo(input);

                    self.event.connectionCreated(connection);
                } catch (e) {
                    alert(e.message);
                } finally {
                    self.pickedOutput = null;
                    self.update();
                }
            });     
        }

        alight.directives.al.pickOutput = function (scope, el, obj) {
            var output = scope.output;

            d3.select(el).on('mousedown', function () {
                self.pickedOutput = output;
            });
        }

        alight.directives.al.controlHtml = function (scope, el, obj) {
            var control = obj.split('.').reduce((o, i) => o[i], scope);

            el.innerHTML = control.html;
        };
    }

    getConnectionPathData(connection, x1, y1, x2, y2) {
        var self = this;
        var distanceX = Math.abs(x1-x2);
        var distanceY = y2-y1;

        var p1 = [x1, y1];
        var p4 = [x2, y2];

        var p2 = [x1 + 0.3 * distanceX, y1 + 0.1 * distanceY];
        var p3 = [x2 - 0.3 * distanceX, y2 - 0.1 * distanceY];

        var points = [p1, p2, p3, p4];

        var curve = d3.curveBasis(d3.path());

        curve.lineStart();
        for (var i = 0; i < points.length;i++) {
            var point = points[i];

            curve.point(self.x(point[0]), self.y(point[1]));
        }
        curve.lineEnd();
        var d = curve._context.toString();

        return d;
    }

    resize() {
        var width = this.dom.parentElement.clientWidth;
        var height = this.dom.parentElement.clientHeight;

        this.svg.style('width', width + 'px')
            .style('height', height + 'px');

        this.clickable
            .attr('width', width + 20)
            .attr('height', height + 20);

        var size = (width + height); // Math.max(width,height);

        this.x.range([0, size]);
        this.y.range([0, size]);

        this.zoom.translateExtent([
            [-size, -size / 2],
            [size * 2, size]
        ]);

        this.update();
    }

    updateConnections() {
        var pathData = [];

        for (var i in this.nodes) {
            var outputs = this.nodes[i].outputs;

            for (var j in outputs) {
                var cons = outputs[j].connections;

                for (var k in cons) {
                    var input = cons[k].input;
                    var output = cons[k].output;

                    pathData.push(this.getConnectionPathData(cons[k], output.positionX(), output.positionY(), input.positionX(), input.positionY()));
                }
            }
        }
        
        if (this.pickedOutput !== null) {
            var mouse = d3.mouse(this.view.node());
            var output = this.pickedOutput;
            var input = [this.x.invert(mouse[0]), this.y.invert(mouse[1])];

            pathData.push(this.getConnectionPathData(null, output.positionX(), output.positionY(), input[0], input[1]));
        }  

        this.$scope.paths = pathData;
    }

    update() {
        this.updateConnections();
        this.$scope.$scan();
    }

    areaClick() {
        if (this.pickedOutput !== null)
        {

            this.pickedOutput = null;
            this.update();
            return;
        }    

        if (this.contextMenu.isVisible())
            this.contextMenu.hide();
        else
            this.contextMenu.show(d3.event.clientX, d3.event.clientY);
    }

    addNode(node) {
        if (!(node instanceof Node)) {
            var builder = this.builders.find(function (b) {
                return b.name === node;
            });

            var pos = d3.mouse(this.view.node());

            node = builder.build();
            node.position = [this.x.invert(pos[0]), this.y.invert(pos[1])];
        }

        this.nodes.push(node);

        this.event.nodeCreated(node);
        this.selectNode(node);
    }

    addGroup(group) {
        this.groups.push(group);
        this.update();
    }

    keyDown() {
        if (this.dom !== document.activeElement)
            return;

        switch (d3.event.keyCode) {
        case 46:
            if (this.active instanceof Node)        
                this.removeNode(this.active);
            else if (this.active instanceof Group)      
                this.removeGroup(this.active);
            this.update();
            break;
        case 71:
            if (!(this.active instanceof Node)) { alert('Select the node for adding to group'); return; }
            var group = new Group('Group', {nodes:[this.active]});    

            this.addGroup(group);   
            break;
        }
    }

    removeNode(node) {
        var index = this.nodes.indexOf(node);

        this.nodes.splice(index, 1);
        node.remove();
        this.event.nodeRemoved(node);

        if (this.nodes.length > 0)
            this.selectNode(this.nodes[Math.max(0, index - 1)]);
        this.update();
    }

    removeGroup(group) {
        group.remove();
        this.groups.splice(this.groups.indexOf(group), 1);
        this.update();
    }

    removeConnection(connection) {
        connection.remove();
        this.event.connectionRemoved(connection);
    }

    selectNode(node) {
        if (this.nodes.indexOf(node) === -1) throw new Error('Node not exist in list');

        this.active = node;
        this.event.nodeSelected(node);
        this.update();
    }

    selectGroup(group) {
        this.active = group;
        this.update();
    }

    remove() {
        this.dom.remove();
    }

    toJSON() {
        var nodes = {};
        var groups = {};
        var sockets = {};

        this.nodes.forEach(node => nodes[node.id] = node.toJSON());
        this.groups.forEach(group => groups[group.id] = group.toJSON());
        this.nodes.forEach(node => {
            node.inputs.forEach(input => {
                var id = input.socket.id;

                if (!sockets[id])
                    sockets[id] = input.socket.toJSON();
            });
            node.outputs.forEach(output => {
                var id = output.socket.id;

                if (!sockets[id])
                    sockets[id] = output.socket.toJSON();
            });
        });

        return {
            'nodes': nodes,
            'groups': groups,
            'sockets': sockets
        };
    }

    fromJSON(json) {
        this.nodes.splice(0, this.nodes.length);
        this.groups.splice(0, this.groups.length);

        var sockets = {};
        var nodes = {};

        Object.keys(json.sockets).forEach(id => {
            sockets[id] = Socket.fromJSON(json.sockets[id]);
        });
        
        Object.keys(json.sockets).forEach(id => {
            json.sockets[id].compatible.forEach(combId => {
                sockets[id].combineWith(sockets[combId])
            });    
        });
        
        Object.keys(json.nodes).forEach(id => {
            this.nodes.push(nodes[id] = Node.fromJSON(json.nodes[id], sockets));
        });
        
        Object.keys(json.nodes).forEach(id => {
            var jsonNode = json.nodes[id];
            var node = nodes[id];
                
            jsonNode.outputs.forEach((outputJson, i) => {
                outputJson.connections.forEach(jsonConnection => {
                    var nodeId = jsonConnection.node;
                    var inputIndex = jsonConnection.input;
                    var targetInput = nodes[nodeId].inputs[inputIndex];

                    node.outputs[i].connectTo(targetInput);
                });
            });

        });  

        Object.keys(json.groups).forEach(id => {
            var group = Group.fromJSON(json.groups[id]);

            json.groups[id].nodes.forEach(nodeId => {
                var node = nodes[nodeId];

                group.addNode(node);
            })
            this.groups.push(group);
        });
        this.update();
    }
}