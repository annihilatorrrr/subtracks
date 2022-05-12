import ProgressHook from '@app/components/ProgressHook'
import RootNavigator from '@app/navigation/RootNavigator'
import queryClient from '@app/query/queryClient'
import SplashPage from '@app/screens/SplashPage'
import colors from '@app/styles/colors'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, InteractionManager, StatusBar, StyleSheet, View } from 'react-native'
import { MenuProvider } from 'react-native-popup-menu'
import { QueryClientProvider } from 'react-query'
import { hasMigratedFromAsyncStorage, migrateFromAsyncStorage } from './state/storage'

const App = () => {
  // TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
  const [hasMigrated, setHasMigrated] = useState(hasMigratedFromAsyncStorage)

  useEffect(() => {
    if (!hasMigratedFromAsyncStorage) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await migrateFromAsyncStorage()
          setHasMigrated(true)
        } catch (e) {
          console.error(e)
        }
      })
    }
  }, [])

  if (!hasMigrated) {
    return (
      <View style={styles.migrateContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MenuProvider backHandler={true}>
        <View style={styles.appContainer}>
          <StatusBar
            animated={true}
            backgroundColor={'rgba(0, 0, 0, 0.3)'}
            barStyle={'light-content'}
            translucent={true}
          />
          <SplashPage>
            <ProgressHook />
            <RootNavigator />
          </SplashPage>
        </View>
      </MenuProvider>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: colors.gradient.high,
  },
  migrateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
})

export default App
