import { loadDashboard } from './dashboard/dashboard.js';
import { initializeTheme, applyTheme } from './theme.js';
import { waitForInitialAuth, subscribeAuth } from './firebase.js';
import { showLoginModal } from './modal.js';
import { initCalendar, refreshCalendarForUser } from './calendar/calendar.js';
import { initAttendance, refreshAttendanceForUser } from './attendance/attendance.js';
import { initSpotlight, showSpotlightFAB, hideSpotlightFAB } from './spotlight/spotlight.js';
import { fetchSessionSettings } from './services/firestoreService.js';

initializeTheme();

// Initialize Spotlight system globally
initSpotlight();

function waitForFullCalendar(timeout = 5000) {
	return new Promise((resolve, reject) => {
		if(window.FullCalendar) return resolve();

		const start = Date.now();

		const iv = setInterval(() => {
			if(window.FullCalendar) {
				clearInterval(iv);
				resolve();
			}

			if(Date.now() - start > timeout) {
				clearInterval(iv);
				reject(new Error('FullCalendar not loaded'));
			}
		}, 100);
	});
}

// Only initialize calendar-related systems on pages that actually use them
const hasCalendarPage = document.getElementById('calendar');
const hasAttendancePage = document.getElementById('attendance-calendar');

if(hasCalendarPage || hasAttendancePage) {
	waitForFullCalendar()
		.then(() => {
			if(hasCalendarPage) {
				initCalendar('calendar');
			}

			if(hasAttendancePage) {
				initAttendance('attendance-calendar');
			}
		})
		.catch((err) => {
			console.warn('FullCalendar not available:', err);
		});
}

// handle initial auth and subsequent changes
waitForInitialAuth().then((initialUid) => {
	if(!initialUid) {
		// force sign-in (block usage until signed in)
		showLoginModal({ onSuccess: () => {}, force: true });
	}
});

subscribeAuth(async (user) => {
	const uid = user ? user.uid : null;
	// Make current user available globally for Spotlight
	window._currentUser = user;

	if(uid) {
		showSpotlightFAB();
		loadDashboard(uid);

		if(hasCalendarPage) {
			refreshCalendarForUser(uid);
		}

		if(hasAttendancePage) {
			refreshAttendanceForUser(uid);
		}

		try {
			const settings = await fetchSessionSettings(uid);
			if (settings?.theme) {
				applyTheme(settings.theme);
			}
		} catch (err) {
			console.warn('Unable to load theme from user settings:', err);
		}
	} else {
		hideSpotlightFAB();
		loadDashboard(null);

		if(hasCalendarPage) {
			refreshCalendarForUser(null);
		}

		if(hasAttendancePage) {
			refreshAttendanceForUser(null);
		}
	}
});

function initMobileNav() {
	const menuToggle = document.querySelector('.menu-toggle');
	const sidebar = document.querySelector('.sidebar');
	const sidebarClose = document.querySelector('.sidebar-close');
	const navLinks = document.querySelectorAll('.sidebar nav a');

	const closeSidebar = () => {
		if(sidebar) sidebar.classList.remove('open');
	};

	if(menuToggle && sidebar) {
		menuToggle.addEventListener('click', () => {
			sidebar.classList.toggle('open');
		});
	}

	if(sidebarClose) {
		sidebarClose.addEventListener('click', closeSidebar);
	}

	navLinks.forEach((link) => {
		link.addEventListener('click', closeSidebar);
	});

	document.addEventListener('click', (event) => {
		if(!sidebar?.classList.contains('open')) return;

		if(
			event.target.closest('.sidebar') ||
			event.target.closest('.menu-toggle')
		) {
			return;
		}

		closeSidebar();
	});
}

initMobileNav();

const today = new Date();
const dateElement = document.getElementById('today-date');

if(dateElement) {
	dateElement.textContent = today.toDateString();
}

if('serviceWorker' in navigator) {
	window.addEventListener('load', async () => {
		try {
			const reg = await navigator.serviceWorker.register('/manager/sw.js');

			console.log('Service Worker Registered');

			if(reg) {
				reg.update();
			}
		} catch(error) {
			console.error('Service Worker Registration Failed:', error);
		}
	});
}