import { Scope } from './scope'
import { BaseSchemes } from './types'

export type Root<Scheme extends BaseSchemes> =
  | { type: 'nodecreate', data: Scheme['Node'], metadata?: any }
  | { type: 'nodecreated', data: Scheme['Node'], metadata?: any }
  | { type: 'noderemove', data: Scheme['Node'], metadata?: any }
  | { type: 'noderemoved', data: Scheme['Node'], metadata?: any }
  | { type: 'connectioncreate', data: Scheme['Connection'], metadata?: any }
  | { type: 'connectioncreated', data: Scheme['Connection'], metadata?: any }
  | { type: 'connectionremove', data: Scheme['Connection'], metadata?: any }
  | { type: 'connectionremoved', data: Scheme['Connection'], metadata?: any }
  | { type: 'clear' }
  | { type: 'clearcancelled' }
  | { type: 'cleared' }

export class NodeEditor<Scheme extends BaseSchemes> extends Scope<Root<Scheme>> {
  private nodes: Scheme['Node'][] = []
  private connections: Scheme['Connection'][] = []

  constructor() {
    super('NodeEditor')
  }

  public getNode(id: Scheme['Node']['id']) {
    return this.nodes.find(node => node.id === id)
  }

  public getNodes() {
    return this.nodes
  }

  public getConnections() {
    return this.connections
  }

  public getConnection(id: Scheme['Connection']['id']) {
    return this.connections.find(connection => connection.id === id)
  }

  async addNode(data: Scheme['Node'], metadata?: any) {
    if (this.getNode(data.id)) throw new Error('node has already been added')

    if (!await this.emit({ type: 'nodecreate', data, metadata })) return false

    this.nodes.push(data)

    await this.emit({ type: 'nodecreated', data, metadata })
    return true
  }

  async addConnection(data: Scheme['Connection'], metadata?: any) {
    if (this.getConnection(data.id)) throw new Error('connection has already been added')

    if (!await this.emit({ type: 'connectioncreate', data, metadata })) return false

    this.connections.push(data)

    await this.emit({ type: 'connectioncreated', data, metadata })
    return true
  }

  async removeNode(id: Scheme['Node']['id'], metadata?: any) {
    const index = this.nodes.findIndex(n => n.id === id)
    const node = this.nodes[index]

    if (index < 0) throw new Error('cannot find node')

    if (!await this.emit({ type: 'noderemove', data: node, metadata })) return false

    this.nodes.splice(index, 1)

    await this.emit({ type: 'noderemoved', data: node, metadata })
    return true
  }

  async removeConnection(id: Scheme['Connection']['id'], metadata?: any) {
    const index = this.connections.findIndex(n => n.id === id)
    const connection = this.connections[index]

    if (index < 0) throw new Error('cannot find connection')

    if (!await this.emit({ type: 'connectionremove', data: connection, metadata })) return false

    this.connections.splice(index, 1)

    await this.emit({ type: 'connectionremoved', data: connection, metadata })
    return true
  }

  async clear() {
    if (!await this.emit({ type: 'clear' })) {
      await this.emit({ type: 'clearcancelled' })
      return false
    }

    for (const connection of this.connections.slice()) await this.removeConnection(connection.id)
    for (const node of this.nodes.slice()) await this.removeNode(node.id)

    await this.emit({ type: 'cleared' })
    return true
  }
}
