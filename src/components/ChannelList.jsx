// src/components/ChannelList.jsx
import React, { useEffect } from 'react';

export default function ChannelList({ channels, balances }) {
  useEffect(() => {
    if (channels.length) {
      console.log('📊 Channel Information:', channels);
      console.log('💰 Balance Information:', balances);
    }
  }, [channels, balances]);

  return null; // Don't render anything in the UI
}
