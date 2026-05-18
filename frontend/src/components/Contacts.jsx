import { useCallback, useState, useEffect } from 'react';

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

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  }, []);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
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
  }, [showToast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

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
      } catch {
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
      } catch {
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

  const handleMessageClick = (phone) => {
    window.dispatchEvent(new CustomEvent('messageContact', {
      detail: { phoneNumber: phone }
    }));
  };

  const handleDeleteClick = (id) => {
    openModal('delete', { id });
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-3xl mx-auto relative">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <span className="text-lg">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Contacts</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl text-xs sm:text-sm text-white font-medium transition"
        >
          + Add Contact
        </button>
      </div>

      <input
        type="text"
        placeholder="Search contacts by name or phone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 mb-4 focus:border-blue-500"
      />

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
          <h3 className="text-base font-semibold mb-4 text-white">Add New Contact</h3>
          <form onSubmit={handleAddClick} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Full Name *"
              value={newContact.name}
              onChange={(e) => setNewContact({...newContact, name: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number *"
              value={newContact.phone}
              onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newContact.email}
              onChange={(e) => setNewContact({...newContact, email: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 sm:col-span-2"
            />
            <input
              type="text"
              placeholder="Company"
              value={newContact.company}
              onChange={(e) => setNewContact({...newContact, company: e.target.value})}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 sm:col-span-2"
            />
            <button 
              type="submit" 
              className="bg-blue-600 py-3 rounded-xl text-sm text-white font-semibold hover:bg-blue-700 sm:col-span-2"
            >
              Save Contact
            </button>
          </form>
        </div>
      )}

      {/* Contacts List */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading contacts...</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No contacts found.</p>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((contact) => (
            <div 
              key={contact._id} 
              className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3 hover:border-blue-500 transition sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{contact.name}</p>
                <p className="text-xs text-gray-400 truncate">{contact.phone}</p>
                {contact.company && <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.company}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCallClick(contact.phone)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-xs text-white font-medium transition"
                >
                  📞 Call
                </button>
                <button
                  onClick={() => handleMessageClick(contact.phone)}
                  className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-xl text-xs text-white font-medium transition"
                >
                  SMS
                </button>
                <button
                  onClick={() => handleDeleteClick(contact._id)}
                  className="bg-red-600/80 hover:bg-red-700 px-3 py-2 rounded-xl text-xs text-white transition"
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
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-3 text-white">
              {modalType === 'call' ? 'Make a Call?' : 
               modalType === 'delete' ? 'Delete Contact?' : 'Save Contact?'}
            </h3>
            
            <p className="text-sm text-gray-400 mb-6">
              {modalType === 'call' && `Do you want to call ${modalData.phone}?`}
              {modalType === 'delete' && 'Are you sure you want to delete this contact? This action cannot be undone.'}
              {modalType === 'add' && 'Do you want to save this new contact?'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm text-white font-medium transition ${
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
