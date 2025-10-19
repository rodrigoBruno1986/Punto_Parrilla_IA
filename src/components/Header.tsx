import { useState, useEffect } from 'react'

function Header() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`bg-white shadow-lg z-40 transition-all duration-300 ${
      isScrolled ? 'fixed top-0 left-0 right-0' : 'relative lg:relative'
    }`}>
      <div className="container mx-auto px-4 transition-all duration-300">
        <div className={`flex items-center transition-all duration-300 ${
          isScrolled ? 'justify-start py-2' : 'justify-start py-4'
        }`}>
          <div className="flex items-center">
            <img 
              src="/logo-2.svg" 
              alt="Punto Parrilla Logo" 
              className={`w-auto transition-all duration-300 ${
                isScrolled ? 'h-12' : 'h-20'
              }`}
            />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
