# Rock Off Chain

_A musical duel powered by machine learning & state channels_
[Watch video here](https://youtu.be/CQqs_9edxMc)

## Overview

**Rock Off Chain** is a playful musical game where your ear and timing are pitted against machine learning—backed by real rewards, paid instantly and securely through off-chain state channels.

In the current MVP:
- A game creator deposits funds via Nitrolite state channels ([ERC-7824](https://erc7824.org/)).
- Players complete musical tasks set by the app to earn payouts.
- The app connects to a nitrolite ClearNode using a pre-funded developer wallet for seamless, gasless off-chain transactions.

See [this presentation](presentation.pdf) for more info.
## Features

- **Musical Challenges:** Players are tasked with performing specific musical intervals (like perfect fifths and minor chords), detected in real-time.
- **Audio Signal Processing:**
  - Audio captured in-browser, processed using [Math.js](https://mathjs.org/) for FFT (Fast Fourier Transform).
  - [essentia.js](https://mtg.github.io/essentia.js/) handles deeper signal analysis.
  - A median filter isolates frequencies in the musical range (20–20,000 Hz).
- **Machine Learning Judgement:**
  - ML models (future: trusted, upgradable) adjudicate the player’s performance.
- **State Channels:**
  - Lightning-fast, gasless payments via Nitrolite ERC-7824 channels.
  - All transactions are auditable and can be settled on-chain.

## Tech Stack

- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Audio Processing:** [Math.js](https://mathjs.org/), [essentia.js](https://mtg.github.io/essentia.js/)
- **Blockchain:**
  - [Nitrolite](https://github.com/erc7824/) State Channels (ERC-7824)
- **Custom Hooks:** For wallet and ClearNode connectivity

## Roadmap

- **MVP:** Solo musical games with machine adjudication and off-chain rewards (current)
- **Future:**
  - Multi-player duels adjudicated by ML
  - On-chain state storage for full auditability
  - Integration of trusted, upgradable ML models
