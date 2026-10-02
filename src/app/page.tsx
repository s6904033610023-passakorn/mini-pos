'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ดึงค่าจาก Environment Variables หรือใช้ค่า Default
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bcqlzonsgkystlwz.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Vq1WX3jH0TiL0Cth21OQ4Q_gxQ-meLY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

interface Product {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  unit: string
}

interface CartItem extends Product {
  cartQty: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)

  // ดึงข้อมูลสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sku', { ascending: true })

    if (error) {
      console.error('Error fetching products:', error)
    } else if (data) {
      setProducts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // เพิ่มสินค้าลงตะกร้า
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('สินค้าหมดสต๊อกแล้ว!')
      return
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id)
      if (existing) {
        if (existing.cartQty >= product.stock) {
          alert(`สินค้าคงเหลือไม่เพียงพอ (เหลือ ${product.stock} ${product.unit})`)
          return prevCart
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, cartQty: item.cartQty + 1 } : item
        )
      } else {
        return [...prevCart, { ...product, cartQty: 1 }]
      }
    })
  }

  // ปรับจำนวนในตะกร้า
  const updateQty = (id: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.cartQty + delta
            if (newQty > item.stock) {
              alert(`สินค้าคงเหลือไม่เพียงพอ (เหลือ ${item.stock} ${item.unit})`)
              return item
            }
            return { ...item, cartQty: newQty }
          }
          return item
        })
        .filter((item) => item.cartQty > 0)
    })
  }

  // ลบสินค้าออกจากตะกร้า
  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id))
  }

  // คำนวณยอดรวม
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.cartQty, 0)
  const totalItems = cart.reduce((sum, item) => sum + item.cartQty, 0)

  // ยืนยันชำระเงิน และบันทึกข้อมูลลง Supabase
  const handleCheckout = async () => {
    if (cart.length === 0) return
    setProcessing(true)

    try {
      // 1. บันทึกรายการขาย
      const salesData = cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.cartQty,
        total_price: item.price * item.cartQty,
      }))

      const { error: salesError } = await supabase.from('sales').insert(salesData)
      if (salesError) throw salesError

      // 2. ตัดสต๊อกสินค้า
      for (const item of cart) {
        const newStock = item.stock - item.cartQty
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id)

        if (updateError) throw updateError
      }

      // ออกใบเสร็จ
      setReceipt({
        items: [...cart],
        total: totalPrice,
        date: new Date().toLocaleString('th-TH'),
      })

      setCart([])
      await fetchProducts() // รีโหลดสต๊อกใหม่
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการทำรายการ: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // กรองสินค้าตามคำค้นหา
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
      <header className="mb-6 bg-white p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-700">🛒 Room Scent POS</h1>
          <p className="text-sm text-gray-500">ระบบแคชเชียร์คิดเงินและตัดสต๊อกหน้าร้าน</p>
        </div>
        <input
          type="text"
          placeholder="🔍 ค้นหาสินค้า หรือ SKU..."
          className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ฝั่งรายการสินค้า */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">รายการสินค้าในร้าน ({filteredProducts.length})</h2>
            {loading ? (
              <div className="text-center py-10 text-gray-400">กำลังโหลดข้อมูลสินค้า...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between ${
                      product.stock <= 0 ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-emerald-500'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {product.sku}
                      </span>
                      <h3 className="font-semibold mt-2 text-sm text-gray-800 line-clamp-2">{product.name}</h3>
                    </div>
                    <div className="mt-4 flex justify-between items-end">
                      <span className="text-lg font-bold text-emerald-600">฿{product.price}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${product.stock > 10 ? 'bg-emerald-100 text-emerald-800' : product.stock > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        คงเหลือ: {product.stock} {product.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ฝั่งตะกร้าสินค้า / คิดเงิน */}
        <div className="lg:col-span-1">
          <div className="bg-white p-5 rounded-xl shadow-sm sticky top-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4 flex justify-between items-center">
              <span>🛒 ตะกร้าสินค้า</span>
              <span className="text-sm bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">{totalItems} ชิ้น</span>
            </h2>

            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🛍️</p>
                <p>ยังไม่มีสินค้าในตะกร้า</p>
                <p className="text-xs text-gray-400 mt-1">คลิกที่รายการสินค้าเพื่อเพิ่ม</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex-1 pr-2">
                      <p className="font-medium text-sm text-gray-800 line-clamp-1">{item.name}</p>
                      <p className="text-xs text-emerald-600 font-semibold">฿{item.price} x {item.cartQty} = ฿{item.price * item.cartQty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-7 h-7 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.cartQty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-7 h-7 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 text-red-500 hover:text-red-700 text-sm p-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>จำนวนรวม</span>
                <span>{totalItems} รายการ</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                <span>ยอดชำระเงิน</span>
                <span className="text-emerald-600">฿{totalPrice.toLocaleString()}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
                className={`w-full py-3 mt-4 rounded-xl font-bold text-white shadow-md transition-all ${
                  cart.length === 0 || processing
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {processing ? 'กำลังบันทึกการขาย...' : '💰 ชำระเงิน / ตัดสต๊อก'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ป๊อปอัป ใบเสร็จรับเงิน */}
      {receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center border-b pb-4 mb-4">
              <h3 className="text-xl font-bold text-emerald-700">🧾 ใบเสร็จรับเงิน</h3>
              <p className="text-sm text-gray-500">Room Scent Official Store</p>
              <p className="text-xs text-gray-400 mt-1">{receipt.date}</p>
            </div>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {receipt.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x {item.cartQty}</span>
                  <span className="font-semibold">฿{item.price * item.cartQty}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex justify-between items-center text-lg font-bold mb-6">
              <span>ยอดเงินรวมทั้งสิ้น</span>
              <span className="text-emerald-600">฿{receipt.total.toLocaleString()}</span>
            </div>

            <button
              onClick={() => setReceipt(null)}
              className="w-full bg-gray-800 text-white py-2.5 rounded-xl font-semibold hover:bg-gray-900"
            >
              ปิดใบเสร็จ / ทำรายการต่อไป
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
