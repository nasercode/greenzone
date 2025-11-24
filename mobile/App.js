import React,{useEffect,useState} from 'react';
import { View, Text, FlatList, Image, SafeAreaView, TouchableOpacity, Modal, Button, TextInput, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const API_BASE = 'REPLACE_WITH_BACKEND_URL';

export default function App(){
  const [products,setProducts]=useState([]);
  const [cart,setCart]=useState({});
  const [selected,setSelected]=useState(null);
  const [email,setEmail]=useState('');

  useEffect(()=>{ fetch(`${API_BASE}/api/products`).then(r=>r.json()).then(setProducts); },[]);

  function add(id,qty=1){ setCart(c=>({...c,[id]:(c[id]||0)+qty})); }
  function setQty(id,qty){ setCart(c=>{ const nc={...c}; if(qty<=0) delete nc[id]; else nc[id]=qty; return nc; }); }
  function cartItems(){ return Object.keys(cart).map(id=>({product:products.find(p=>p.id===parseInt(id)), qty:cart[id]})).filter(ci=>ci.product); }
  function total(){ return cartItems().reduce((s,ci)=>s+ci.product.price_cents*ci.qty,0); }

  async function checkout(){
    const items = cartItems().map(ci=>({ id:ci.product.id, quantity:ci.qty }));
    if(items.length===0) return alert('Cart empty');
    const res = await fetch(`${API_BASE}/api/create-checkout-session`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items, customerEmail: email || null })});
    const data = await res.json();
    if (data.url) WebBrowser.openBrowserAsync(data.url);
    else alert('Checkout error: ' + (data.error || 'unknown'));
  }

  return (
    <SafeAreaView style={{flex:1}}>
      <View style={styles.header}><Text style={styles.headerText}>Green zone</Text></View>
      <FlatList data={products} keyExtractor={p=>String(p.id)} numColumns={2} contentContainerStyle={{padding:8}}
        renderItem={({item})=>(
          <TouchableOpacity style={styles.card} onPress={()=>setSelected(item)}>
            {item.image_url ? <Image source={{uri:item.image_url}} style={{width:'100%',height:120}} /> : null}
            <Text style={{fontWeight:'bold'}}>{item.name}</Text>
            <Text>${(item.price_cents/100).toFixed(2)}</Text>
            <Button title="Add" onPress={()=>add(item.id)} />
          </TouchableOpacity>
        )} />
      <View style={styles.cart}>
        <Text style={{fontWeight:'bold'}}>Cart — ${(total()/100).toFixed(2)}</Text>
        {cartItems().length===0 ? <Text>Empty</Text> : cartItems().map(ci=>(
          <View key={ci.product.id} style={{flexDirection:'row',justifyContent:'space-between',marginTop:6}}>
            <Text>{ci.product.name}</Text>
            <View style={{flexDirection:'row',alignItems:'center'}}><Button title="-" onPress={()=>setQty(ci.product.id,ci.qty-1)}/><Text style={{marginHorizontal:8}}>{ci.qty}</Text><Button title="+" onPress={()=>setQty(ci.product.id,ci.qty+1)}/></View>
          </View>
        ))}
        <TextInput placeholder="Email (optional)" value={email} onChangeText={setEmail} style={{borderWidth:1,padding:8,marginTop:8}} />
        <TouchableOpacity onPress={checkout} style={{backgroundColor:'#2a9d45',padding:12,borderRadius:6,marginTop:8}}><Text style={{color:'white',textAlign:'center'}}>Checkout — Credit card</Text></TouchableOpacity>
      </View>

      <Modal visible={!!selected} onRequestClose={()=>setSelected(null)}>
        {selected && <View style={{flex:1}}><Image source={{uri:selected.image_url}} style={{width:'100%',height:240}}/><View style={{padding:12}}><Text style={{fontSize:20,fontWeight:'bold'}}>{selected.name}</Text><Text style={{marginVertical:8}}>${(selected.price_cents/100).toFixed(2)}</Text><Text>{selected.description}</Text><Button title="Add to cart" onPress={()=>{ add(selected.id); setSelected(null); }}/><Button title="Close" onPress={()=>setSelected(null)} /></View></View>}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:{padding:12,backgroundColor:'#2a9d45'}, headerText:{color:'white',fontSize:20,fontWeight:'bold'},
  card:{flex:1,margin:8,padding:8,borderRadius:8,backgroundColor:'white',elevation:2},
  cart:{padding:12,backgroundColor:'#fff',borderTopWidth:1,borderColor:'#eee'}
});
