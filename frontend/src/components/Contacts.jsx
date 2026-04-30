import { useState, useEffect } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    company: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Show Toast Notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 3000);
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      showToast('Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) {
      return showToast("Name and Phone number are required", "error");
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newContact)
      });

      if (res.ok) {
        showToast("Contact added successfully!", "success");
        setNewContact({ name: '', phone: '', email: '', company: '' });
        setShowAddForm(false);
        fetchContacts();
      } else {
        showToast("Failed to add contact", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to add contact", "error");
    }
  };

  const handleCall = (phoneNumber) => {
    const event = new CustomEvent('callContact', { 
      detail: { phoneNumber } 
    });
    window.dispatchEvent(event);
    
    showToast(`Calling ${phoneNumber}...`, "success");
  };

  const deleteContact = async (id) => {
    if (!window.confirm("Delete this contact?")) return;

    try {
      await fetch(`${BACKEND_URL}/api/contacts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      showToast("Contact deleted successfully", "success");
      fetchContacts();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete contact", "error");
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="text-2xl">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Contacts</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl text-white font-medium transition"
        >
          + Add Contact
        </button>
      </div>

      <input
        type="text"
        placeholder="Search contacts by name or phone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl px-5 py-4 mb-8 focus:border-blue-500"
      />

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 mb-8">
          <h3 className="text-xl font-semibold mb-6 text-white">Add New Contact</h3>
          <form onSubmit={handleAddContact} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Full Name *"
              value={newContact.name}
              onChange={(e) => setNewContact({...newContact, name: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number *"
              value={newContact.phone}
              onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newContact.email}
              onChange={(e) => setNewContact({...newContact, email: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 col-span-2"
            />
            <input
              type="text"
              placeholder="Company"
              value={newContact.company}
              onChange={(e) => setNewContact({...newContact, company: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 col-span-2"
            />
            <button 
              type="submit" 
              className="col-span-2 bg-blue-600 py-4 rounded-2xl text-white font-semibold hover:bg-blue-700"
            >
              Save Contact
            </button>
          </form>
        </div>
      )}

      {/* Contacts List */}
      {loading ? (
        <p className="text-gray-400 text-center py-10">Loading contacts...</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No contacts found.</p>
      ) : (
        <div className="space-y-3">
          {filteredContacts.map((contact) => (
            <div 
              key={contact._id} 
              className="bg-gray-900 border border-gray-700 rounded-3xl p-6 flex justify-between items-center hover:border-blue-500 transition"
            >
              <div>
                <p className="text-lg font-medium text-white">{contact.name}</p>
                <p className="text-gray-400">{contact.phone}</p>
                {contact.company && <p className="text-sm text-gray-500 mt-1">{contact.company}</p>}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleCall(contact.phone)}
                  className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-2xl text-white font-medium transition"
                >
                  📞 Call
                </button>
                <button
                  onClick={() => deleteContact(contact._id)}
                  className="bg-red-600/80 hover:bg-red-700 px-5 py-3 rounded-2xl text-white transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Contacts;