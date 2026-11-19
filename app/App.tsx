import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { openBook } from './src/books/library';
import { validateContent } from './src/content';
import { store } from './src/data/store';
import { Engine } from './src/engine/engine';
import { migrate } from './src/engine/state';
import { scheduleNudges } from './src/feedback/notify';
import { fx } from './src/feedback/sound';
import { themes } from './src/theme';
import { AppProvider, useEngineVersion } from './src/ui/context';
import { Feed, markInteractedRef } from './src/ui/Feed';
import { MeSheet } from './src/ui/MeSheet';
import type { OverlayHandle } from './src/ui/Overlays';

export default function App() {
  const [fontsLoaded] = useFonts({
    ArchivoCondBlack: require('./assets/fonts/ArchivoCondBlack.ttf'),
    ArchivoCondHeavy: require('./assets/fonts/ArchivoCondHeavy.ttf'),
    ArchivoRegular: require('./assets/fonts/ArchivoRegular.ttf'),
    ArchivoSemiBold: require('./assets/fonts/ArchivoSemiBold.ttf'),
    ArchivoBold: require('./assets/fonts/ArchivoBold.ttf'),
  });
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    if (__DEV__) {
      const errs = validateContent();
      if (errs.length) console.warn('Content errors:\n' + errs.join('\n'));
    }
    const start = async (raw: unknown) => {
      const e = new Engine(migrate(raw));
      // Resume the current book. New users start with a short one; it can be changed under Me → Books.
      const id = e.s.activeBook ?? (Object.keys(e.s.books).length === 0 ? 'time-machine' : null);
      if (id) await openBook(e, id).catch(() => false);
      setEngine(e);
    };
    store.load().then(start).catch(() => start(null));
  }, []);

  if (!fontsLoaded || !engine) {
    return <View style={{ flex: 1, backgroundColor: '#1E3CFF' }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Main engine={engine} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main({ engine }: { engine: Engine }) {
  const version = useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [meOpen, setMeOpen] = useState(false);
  const overlayRef = useRef<OverlayHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = themes.swiss;

  // keep feedback settings in sync
  fx.theme = theme.name;
  fx.sound = engine.s.settings.sound;
  fx.haptics = engine.s.settings.haptics;
  useEffect(() => { fx.init(); }, []);

  const persist = useCallback(() => {
    store.save(engine.s).catch(() => {});
    store.log(engine.drainLog()).catch(() => {});
  }, [engine]);

  // debounced save after every change
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 700);
  }, [version, persist]);

  useEffect(() => {
    scheduleNudges(engine);
    const sub = AppState.addEventListener('change', st => {
      if (st !== 'active') { persist(); scheduleNudges(engine); }
    });
    return () => sub.remove();
  }, [engine, persist]);

  const ctx = useMemo(() => ({
    engine, theme,
    markInteracted: (k: string) => markInteractedRef.current(k),
    toast: (t: string) => overlayRef.current?.toast(t),
  }), [engine, theme]);

  return (
    <AppProvider value={ctx}>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Feed onOpenMe={() => setMeOpen(true)} overlayRef={overlayRef} />
      </View>
      <MeSheet visible={meOpen} onClose={() => setMeOpen(false)} loadEvents={store.events} />
    </AppProvider>
  );
}
