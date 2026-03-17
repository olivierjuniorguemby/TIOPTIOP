import { useEffect, useRef } from "react"
import { Toast } from "bootstrap"

function ToastContainer() {

  const toastRef = useRef(null)

  useEffect(() => {
    window.showToast = (message) => {
      const toastEl = toastRef.current
      toastEl.querySelector(".toast-body").innerText = message

      const toast = new Toast(toastEl)
      toast.show()
    }
  }, [])

  return (
    <div className="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        ref={toastRef}
        className="toast tt-card"
        role="alert"
      >
        <div className="toast-body"></div>
      </div>
    </div>
  )
}

export default ToastContainer