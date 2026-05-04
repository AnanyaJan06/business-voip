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

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'add', 'call', 'delete'
  const [modalData, setModalData] = useState({});

  // Toast for success messages
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
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

  // Open Confirmation Modal
  const openModal = (type, data = {}) => {
    setModalType(type);
    setModalData(data);
    setShowModal(true);
  };

  const handleModalConfirm = async () => {
    if (modalType === 'add') {
      // Handle add contact
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
          showToast("✅ Contact added successfully!", "success");
          setNewContact({ name: '', phone: '', email: '', company: '' });
          setShowAddForm(false);
          fetchContacts();
        }
      } catch (err) {
        showToast("Failed to add contact", "error");
      }
    } 
    else if (modalType === 'call') {
      const event = new CustomEvent('callContact', { 
        detail: { phoneNumber: modalData.phone } 
      });
      window.dispatchEvent(event);
      showToast(`📞 Calling ${modalData.phone}...`, "success");
    } 
    else if (modalType === 'delete') {
      try {
        await fetch(`${BACKEND_URL}/api/contacts/${modalData.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        showToast("🗑️ Contact deleted successfully", "success");
        fetchContacts();
      } catch (err) {
        showToast("Failed to delete contact", "error");
      }
    }

    setShowModal(false);
  };

  const handleAddClick = (e) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) {
      return showToast("Name and Phone number are required", "error");
    }
    openModal('add');
  };

  const handleCallClick = (phone) => {
    openModal('call', { phone });
  };

  const handleDeleteClick = (id) => {
    openModal('delete', { id });
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="text-2xl">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Contacts</h2>
        <button
          onClick={() => setShowAddForm(true)}
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
          <form onSubmit={handleAddClick} className="grid grid-cols-2 gap-4">
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
                  onClick={() => handleCallClick(contact.phone)}
                  className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-2xl text-white font-medium transition"
                >
                  📞 Call
                </button>
                <button
                  onClick={() => handleDeleteClick(contact._id)}
                  className="bg-red-600/80 hover:bg-red-700 px-5 py-3 rounded-2xl text-white transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 text-white">
              {modalType === 'call' ? 'Make a Call?' : 
               modalType === 'delete' ? 'Delete Contact?' : 'Save Contact?'}
            </h3>
            
            <p className="text-gray-400 mb-8">
              {modalType === 'call' && `Do you want to call ${modalData.phone}?`}
              {modalType === 'delete' && 'Are you sure you want to delete this contact? This action cannot be undone.'}
              {modalType === 'add' && 'Do you want to save this new contact?'}
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className={`flex-1 py-3 rounded-2xl text-white font-medium transition ${
                  modalType === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {modalType === 'call' ? 'Call Now' : 
                 modalType === 'delete' ? 'Delete' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;