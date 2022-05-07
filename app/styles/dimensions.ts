import { FlatListProps } from 'react-native'

const header = 56
const tabBar = 54

const bottom = () => tabBar

export const listItemDefault = {
  size: 50,
  marginBottom: 10,
}

export const listItemDefaultHeight = listItemDefault.size + listItemDefault.marginBottom

export const listItemDefaultLayout: FlatListProps<any>['getItemLayout'] = (data, index) => ({
  length: listItemDefaultHeight,
  offset: listItemDefaultHeight * index,
  index,
})

export const listItemBig = {
  size: 70,
  marginBottom: 10,
}

export const listItemBigHeight = listItemBig.size + listItemBig.marginBottom

export const listItemBigLayout: FlatListProps<any>['getItemLayout'] = (data, index) => ({
  length: listItemDefaultHeight,
  offset: listItemDefaultHeight * index,
  index,
})

export default {
  header,
  tabBar,
  bottom,
}
