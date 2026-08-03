// Ponte com o plugin nativo Android `ShareReceiver` (ver android/.../ShareReceiverPlugin.java):
// recebe o texto/link que o usuário compartilhou de outro app via a folha de compartilhamento.

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ShareReceivedData {
  text: string;
}

interface ShareReceiverPlugin {
  addListener(
    eventName: 'shareReceived',
    listenerFunc: (data: ShareReceivedData) => void,
  ): Promise<PluginListenerHandle>;
}

export const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');
