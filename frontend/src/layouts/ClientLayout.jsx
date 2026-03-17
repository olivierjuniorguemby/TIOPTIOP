import React from 'react'
import NavbarClient from "../components/client/NavbarClient"
import SidebarClientMobile from "../components/client/SidebarClientMobile"
import FooterClient from "../components/client/FooterClient"
import FooterMobileNav from "../components/client/FooterMobileNav"
import ToastContainer from "../components/client/ToastContainer"
import { Outlet } from "react-router-dom"

function ClientLayout() {
  return (
    <>
      <NavbarClient />
      <SidebarClientMobile />

      <main className="container my-4">
        <Outlet />
      </main>

      <FooterClient />
      <FooterMobileNav />
      <ToastContainer />
    </>
  )
}

export default ClientLayout