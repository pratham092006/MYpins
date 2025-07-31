// Sample pins data with categories
const pinsData = [
    {
        id: 1,
        title: "Modern Living Room",
        description: "Contemporary design with minimalist approach",
        imageUrl: "IMG/ModernLivingRoom.png",
        category: "design"
    },
    {
        id: 2,
        title: "Healthy Breakfast",
        description: "Start your day with nutritious meals",
        imageUrl: "IMG/Breakfast.png",
        category: "food"
    },
    {
        id: 3,
        title: "Mountain Escape",
        description: "Breathtaking views for nature lovers",
        imageUrl: "IMG/Mountain.png",
        category: "travel"
    },
    {
        id: 4,
        title: "Abstract Painting",
        description: "Colorful modern art piece",
        imageUrl: "IMG/Painting.png",
        category: "art"
    },
    {
        id: 5,
        title: "Portrait Photography",
        description: "Professional portrait techniques",
        imageUrl: "IMG/PortraitPhoto.png",
        category: "photography"
    },
    {
        id: 6,
        title: "Italian Cuisine",
        description: "Authentic pasta recipes",
        imageUrl: "IMG/ItalianCuisine.png",
        category: "food"
    }
];

// DOM elements
const pinsContainer = document.getElementById('pinsContainer');
const explorePinsContainer = document.getElementById('explorePinsContainer');
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const createBtn = document.getElementById('createBtn');
const createModal = document.getElementById('createModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const createPinForm = document.getElementById('createPinForm');
const homePage = document.getElementById('homePage');
const explorePage = document.getElementById('explorePage');
const navLinks = document.querySelectorAll('.nav-link');
const categories = document.querySelectorAll('.category');
const searchInput = document.getElementById('searchInput');
const imageUploadContainer = document.getElementById('imageUploadContainer');
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');

// Current user state
let currentUser = null;
let uploadedImage = null;

// Render pins function
function renderPins(pins, container) {
    container.innerHTML = '';
    pins.forEach(pin => {
        const pinElement = document.createElement('div');
        pinElement.className = 'pin';
        pinElement.innerHTML = `
            <img src="${pin.imageUrl}" alt="${pin.title}" class="pin-image">
            <div class="pin-info">
                <h3 class="pin-title">${pin.title}</h3>
                <p class="pin-desc">${pin.description}</p>
            </div>
        `;
        container.appendChild(pinElement);
    });
}

// Filter pins by category
function filterPinsByCategory(category) {
    if (category === 'all') {
        renderPins(pinsData, explorePinsContainer);
        return;
    }
    const filteredPins = pinsData.filter(pin => pin.category === category);
    renderPins(filteredPins, explorePinsContainer);
}

// Search pins
function searchPins(query) {
    const lowerQuery = query.toLowerCase();
    const filteredPins = pinsData.filter(pin => 
        pin.title.toLowerCase().includes(lowerQuery) || 
        pin.description.toLowerCase().includes(lowerQuery)
    );
    
    const currentPage = document.querySelector('.page-content:not([style*="display: none"])').id;
    if (currentPage === 'homePage') {
        renderPins(filteredPins, pinsContainer);
    } else {
        renderPins(filteredPins, explorePinsContainer);
    }
}

// Initialize pins
renderPins(pinsData, pinsContainer);
renderPins(pinsData, explorePinsContainer);

// Image upload functionality
imageUploadContainer.addEventListener('click', () => {
    imageUpload.click();
});
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            uploadedImage = event.target.result;

            // Hide upload icon and text
            const uploadIcon = imageUploadContainer.querySelector('i');
            const uploadText = imageUploadContainer.querySelector('p');
            if (uploadIcon) uploadIcon.style.display = 'none';
            if (uploadText) uploadText.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
});

// Modal functionality
loginBtn.addEventListener('click', () => {
    if (currentUser) {
        // Log out if already logged in
        currentUser = null;
        loginBtn.textContent = "Log in";
        return;
    }
    loginModal.classList.add('active');
});
closeLoginModal.addEventListener('click', () => {
    loginModal.classList.remove('active');
});
createBtn.addEventListener('click', () => {
    if (!currentUser) {
        loginModal.classList.add('active');
        return;
    }
    createModal.classList.add('active');
});
closeCreateModal.addEventListener('click', () => {
    resetCreateModal();
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.classList.remove('active');
    if (e.target === createModal) resetCreateModal();
});

// Navigation between pages
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        
        // Update active nav link
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        link.classList.add('active');
        
        // Show the selected page
        if (page === 'home') {
            homePage.style.display = 'block';
            explorePage.style.display = 'none';
            renderPins(pinsData, pinsContainer);
        } else if (page === 'explore') {
            homePage.style.display = 'none';
            explorePage.style.display = 'block';
            renderPins(pinsData, explorePinsContainer);
        }
    });
});

// Category filtering
categories.forEach(category => {
    category.addEventListener('click', () => {
        categories.forEach(cat => cat.classList.remove('active'));
        category.classList.add('active');
        const selectedCategory = category.getAttribute('data-category');
        filterPinsByCategory(selectedCategory);
    });
});

// Search functionality
searchInput.addEventListener('input', (e) => {
    searchPins(e.target.value);
});

// Login form
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    
    if (email) {
        currentUser = email;
        loginBtn.textContent = "Log out";
        loginModal.classList.remove('active');
        loginForm.reset();
    }
});

// Create Pin form
createPinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('pinTitle').value;
    const description = document.getElementById('pinDescription').value;
    const category = document.getElementById('pinCategory').value;
    
    if (title && uploadedImage) {
        // Create new pin object
        const newPin = {
            id: pinsData.length + 1,
            title,
            description,
            imageUrl: uploadedImage,
            category
        };
        
        // Add to the beginning of pins array
        pinsData.unshift(newPin);

        // Show Home Page automatically
        homePage.style.display = 'block';
        explorePage.style.display = 'none';

        // Re-render pins
        renderPins(pinsData, pinsContainer);
        
        // Close modal and reset form
        resetCreateModal();
    } else if (!uploadedImage) {
        alert('Please upload an image');
    }
});

// Reset create modal function
function resetCreateModal() {
    createModal.classList.remove('active');
    createPinForm.reset();
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    uploadedImage = null;

    // Show upload icon and text again
    const uploadIcon = imageUploadContainer.querySelector('i');
    const uploadText = imageUploadContainer.querySelector('p');
    if (uploadIcon) uploadIcon.style.display = 'block';
    if (uploadText) uploadText.style.display = 'block';
}
