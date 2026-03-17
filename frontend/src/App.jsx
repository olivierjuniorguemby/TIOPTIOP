import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientLayout from './layouts/ClientLayout'

import Home from './pages/client/Home'
import Menu from './pages/client/Menu'
import Cart from './pages/client/Cart'
import Tracking from './pages/client/Tracking'
import Contact from './pages/client/Contact'
import About from './pages/client/About'

import Dashboard from './pages/admin/Dashboard'
import Products from './pages/admin/Products'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ⭐ ROUTES CLIENT AVEC LAYOUT */}
        <Route element={<ClientLayout />}>
          <Route path='/' element={<Home />} />
          <Route path='/menu' element={<Menu />} />
          <Route path='/cart' element={<Cart />} />
          <Route path='/tracking' element={<Tracking />} />
          <Route path='/contact' element={<Contact />} />
          <Route path='/about' element={<About />} />
        </Route>

        {/* ⭐ ROUTES ADMIN */}
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/products" element={<Products />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App