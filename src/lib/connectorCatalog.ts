import connectorsJson from '../data/connectors.json?raw'
import type { ConnectorCategory, ConnectorDefinition } from '../types'

const CATEGORY_ORDER: ConnectorCategory[] = ['audio', 'data', 'power', 'multipin', 'other']

function parseConnectorCatalog(): ConnectorDefinition[] {
  const parsed = JSON.parse(connectorsJson) as ConnectorDefinition[]
  return parsed.map((entry) => ({
    ...entry,
    grid_width: Math.max(1, Math.round(entry.grid_width)),
    grid_height: Math.max(1, Math.round(entry.grid_height)),
    weight_kg: Number.isFinite(entry.weight_kg) ? Math.max(0, entry.weight_kg) : 0,
  }))
}

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = parseConnectorCatalog()

export const CONNECTOR_BY_ID = new Map(CONNECTOR_DEFINITIONS.map((connector) => [connector.id, connector]))

export function groupedConnectors(): Array<{ category: ConnectorCategory; items: ConnectorDefinition[] }> {
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      items: CONNECTOR_DEFINITIONS.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0)
}
