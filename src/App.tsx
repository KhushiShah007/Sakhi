import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n'
import { PhoneFrame } from './components/Frame'
import Welcome from './screens/Welcome'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import CheckIn from './screens/CheckIn'
import Vent from './screens/Vent'
import Translator from './screens/Translator'
import RightNow from './screens/RightNow'
import ThreeAM from './screens/ThreeAM'
import Rehearsal from './screens/Rehearsal'
import Letter from './screens/Letter'
import Brief from './screens/Brief'
import Privacy from './screens/Privacy'
import MissedCall from './screens/MissedCall'
import { History, Me } from './screens/Tabs'
import FamilyChat from './family/FamilyChat'
import Lesson from './family/Lesson'
import FamilyLink from './family/FamilyLink'
import HRDashboard from './hr/HRDashboard'
import Demo from './demo/Demo'
import Hero from './demo/Hero'

const phone = (el: ReactNode) => <PhoneFrame>{el}</PhoneFrame>

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={phone(<Welcome />)} />
          <Route path="/onboarding" element={phone(<Onboarding />)} />
          <Route path="/home" element={phone(<Home />)} />
          <Route path="/checkin" element={phone(<CheckIn />)} />
          <Route path="/vent" element={phone(<Vent />)} />
          <Route path="/translator" element={phone(<Translator />)} />
          <Route path="/right-now" element={phone(<RightNow />)} />
          <Route path="/3am" element={phone(<ThreeAM />)} />
          <Route path="/rehearsal" element={phone(<Rehearsal />)} />
          <Route path="/letter" element={phone(<Letter />)} />
          <Route path="/brief" element={phone(<Brief />)} />
          <Route path="/privacy" element={phone(<Privacy />)} />
          <Route path="/missed-call" element={phone(<MissedCall />)} />
          <Route path="/history" element={phone(<History />)} />
          <Route path="/me" element={phone(<Me />)} />
          <Route path="/family" element={phone(<FamilyChat />)} />
          <Route path="/family/lesson" element={phone(<Lesson />)} />
          <Route path="/f/:token" element={<FamilyLink />} />
          <Route path="/hr" element={<HRDashboard />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/hero" element={<Hero />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
