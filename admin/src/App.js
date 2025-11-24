import React, {useEffect,useState} from 'react';
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4242';

function Login({onLogin}) {
  const [pass,setPass] = useState('');
  return <div className="container"><h2>Green zone Admin</h2>
    <input placeholder="Admin password" value={pass} onChange={e=>setPass(e.target.value)}/>
    <button onClick={()=>onLogin(pass)}>Sign in</button>
  </div>;
}

function ProductForm({token, onDone, existing}) {
  const [form,setForm] = useState(existing || {name:'',description:'',price_cents:0,image_url:'',stock:100});
  async function submit(){
    const method = existing ? 'PUT' : 'POST';
    const url = existing ? `${API_BASE}/api/admin/product/${existing.id}` : `${API_BASE}/api/admin/product`;
    await fetch(url,{method,headers:{'Content-Type':'application/json','x-admin-password':token},body:JSON.stringify(form)});
    onDone();
  }
  return <div className="card">
    <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <input placeholder="Price (cents)" type="number" value={form.price_cents} onChange={e=>setForm({...form,price_cents:parseInt(e.target.value||0)})}/>
    <input placeholder="Image URL" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/>
    <textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
    <input placeholder="Stock" type="number" value={form.stock} onChange={e=>setForm({...form,stock:parseInt(e.target.value||0)})}/>
    <button onClick={submit}>{existing ? 'Save' : 'Add product'}</button>
  </div>;
}

export default function App(){
  const [token,setToken] = useState(localStorage.getItem('adminToken')||null);
  const [products,setProducts] = useState([]);
  const [orders,setOrders] = useState([]);
  const [editing,setEditing] = useState(null);

  async function load(){
    const res = await fetch(`${API_BASE}/api/products`);
    setProducts(await res.json());
    if (token) {
      const r2 = await fetch(`${API_BASE}/api/admin/orders`,{headers:{'x-admin-password':token}});
      setOrders(await r2.json());
    }
  }
  useEffect(()=>{ load(); }, [token]);

  function login(p){ localStorage.setItem('adminToken',p); setToken(p); }

  async function del(id){ await fetch(`${API_BASE}/api/admin/product/${id}`,{method:'DELETE',headers:{'x-admin-password':token}}); load(); }
  async function ship(id){ await fetch(`${API_BASE}/api/admin/order/${id}/ship`,{method:'POST',headers:{'x-admin-password':token}}); load(); }

  if (!token) return <Login onLogin={login} />;
  return <div>
    <div className="header"><h1 style={{margin:0}}>Green zone — Admin</h1></div>
    <div className="container">
      <h3>Products</h3>
      <ProductForm token={token} onDone={load} />
      <div>
        {products.map(p=>(
          <div className="card" key={p.id}>
            <img className="thumb" src={p.image_url} alt=""/>
            <div><strong>{p.name}</strong> — ${(p.price_cents/100).toFixed(2)} — stock: {p.stock}</div>
            <button onClick={()=>setEditing(p)}>Edit</button>
            <button onClick={()=>del(p.id)}>Delete</button>
          </div>
        ))}
      </div>

      <h3>Orders</h3>
      {orders.map(o=>(
        <div className="card" key={o.id}>
          <div>Order #{o.id} — {o.status} — Shipped: {o.shipped ? 'Yes' : 'No'}</div>
          <div>Customer: {o.customerEmail || '—'}</div>
          <ul>{(o.OrderItems||[]).map(it=><li key={it.id}>{it.name} x {it.quantity}</li>)}</ul>
          {!o.shipped && <button onClick={()=>ship(o.id)}>Mark as shipped</button>}
        </div>
      ))}
      {editing && <div><h4>Edit</h4><ProductForm token={token} existing={editing} onDone={()=>{setEditing(null);load();}}/></div>}
    </div>
  </div>;
}
