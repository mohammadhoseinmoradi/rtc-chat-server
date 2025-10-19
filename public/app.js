class ChatApp {
    constructor() {
        this.socket = null;
        this.rtcSocket = null;
        this.currentUser = null;
        this.selectedUser = null;
        this.peerConnection = null;
        this.localStream = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.checkExistingToken();
    }

    bindEvents() {
        // فعال کردن ارسال پیام با دکمه Enter
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    checkExistingToken() {
        // بررسی اینکه کاربر قبلاً وارد شده
        const token = localStorage.getItem('chat_token');
        if (token) {
            this.connectToSocket(token);
        }
    }

    // 🔐 مدیریت احراز هویت
    async register() {
        const username = document.getElementById('usernameInput').value;
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;

        if (!username || !email || !password) {
            this.showMessage('سیستم', 'لطفا تمام فیلدها را پر کنید', 'other');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage('سیستم', data.message || 'خطا در ثبت‌نام', 'other');
            }
        } catch (error) {
            this.showMessage('سیستم', 'خطا در ارتباط با سرور', 'other');
        }
    }

    async login() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;

        if (!email || !password) {
            this.showMessage('سیستم', 'لطفا ایمیل و رمز عبور را وارد کنید', 'other');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.handleAuthSuccess(data);
            } else {
                this.showMessage('سیستم', data.message || 'خطا در ورود', 'other');
            }
        } catch (error) {
            this.showMessage('سیستم', 'خطا در ارتباط با سرور', 'other');
        }
    }

    handleAuthSuccess(data) {
        this.currentUser = data.user;
        localStorage.setItem('chat_token', data.access_token);
        localStorage.setItem('user_info', JSON.stringify(data.user));

        this.updateUIAfterAuth();
        this.connectToSocket(data.access_token);
        
        this.showMessage('سیستم', `خوش آمدید ${data.user.username}!`, 'other');
    }

    updateUIAfterAuth() {
        // مخفی کردن بخش لاگین
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('userInfoSection').classList.remove('hidden');
        
        // نمایش اطلاعات کاربر
        document.getElementById('userInfo').innerHTML = `
            <div><strong>نام:</strong> ${this.currentUser.username}</div>
            <div><strong>ایمیل:</strong> ${this.currentUser.email}</div>
        `;

        // فعال کردن ورودی پیام
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendButton').disabled = false;
    }

    // 🔌 اتصال به WebSocket
    connectToSocket(token) {
        // اتصال به چت
        this.socket = io('http://localhost:3000/chat', {
            auth: {
                token: token
            }
        });
    console.log('🔌 Chat socket created');

        // اتصال به WebRTC
        this.rtcSocket = io('http://localhost:3000/webrtc', {
            auth: {
                token: token
            }
        });
    console.log('🔌 WebRTC socket created');
    console.log('🔌 WebRTC socket instance:', this.rtcSocket);
        this.setupSocketListeners();
        this.setupRtcSocketListeners();
    }

setupSocketListeners() {
    console.log('Setting up socket listeners...'); // دیباگ
    
    this.socket.on('connect', () => {
        console.log('✅ Socket connected with ID:', this.socket.id);
        this.updateConnectionStatus(true);
        this.showMessage('سیستم', 'اتصال برقرار شد', 'other');
    });

    this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        this.updateConnectionStatus(false);
        this.showMessage('سیستم', 'اتصال قطع شد', 'other');
    });

    this.socket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', error);
    });

    // دریافت لیست کاربران آنلاین
    this.socket.on('online_users', (users) => {
        console.log('👥 Online users received:', users);
        this.updateOnlineUsers(users);
    });

    // دریافت پیام جدید
    this.socket.on('new_message', (message) => {
        console.log('📩 New message received:', message);
        console.log('📩 Current selectedUser:', this.selectedUser);
        console.log('📩 Current user ID:', this.currentUser?.id);
        
        // نمایش همه پیام‌ها بدون شرط (موقت برای تست)
        this.showMessage(
            message.sender.username, 
            message.content, 
            message.sender.id === this.currentUser.id ? 'own' : 'other'
        );
    });

    // کاربر جدید وصل شد
    this.socket.on('user_connected', (data) => {
        console.log('🟢 User connected:', data);
        this.showMessage('سیستم', `👋 ${data.username} آنلاین شد`, 'other');
        this.updateOnlineUsers(data.onlineUsers);
    });

    // کاربر قطع شد
    this.socket.on('user_disconnected', (data) => {
        console.log('🔴 User disconnected:', data);
        this.showMessage('سیستم', `👋 ${data.username} آفلاین شد`, 'other');
        this.updateOnlineUsers(data.onlineUsers);
    });

    // دریافت تاریخچه چت
    this.socket.on('chat_history', (messages) => {
        console.log('📚 Chat history received:', messages);
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            this.showMessage(
                message.sender.username, 
                message.content, 
                message.sender.id === this.currentUser.id ? 'own' : 'other'
            );
        });
    });

    this.socket.on('error', (error) => {
        console.error('💥 Socket error:', error);
        this.showMessage('سیستم', `خطا: ${error.message}`, 'other');
    });

    // لیستنینر برای همه events (برای دیباگ)
    this.socket.onAny((eventName, ...args) => {
        console.log(`🎯 Socket event [${eventName}]:`, args);
    });
}

   setupRtcSocketListeners() {
     console.log('🔧 Setting up WebRTC socket listeners...');
    console.log('🔧 WebRTC socket connected?', this.rtcSocket?.connected);
    
    // دیباگ اتصال WebRTC
    this.rtcSocket.on('connect', () => {
        console.log('✅ WebRTC Socket connected! ID:', this.rtcSocket.id);
    });

    this.rtcSocket.on('disconnect', (reason) => {
        console.log('❌ WebRTC Socket disconnected:', reason);
    });

    this.rtcSocket.on('connect_error', (error) => {
        console.error('🔴 WebRTC Socket connection error:', error);
    });

    // دیباگ برای همه events
    this.rtcSocket.onAny((eventName, ...args) => {
        console.log(`🎯 WebRTC Socket event [${eventName}]:`, args);
    });
    // دریافت درخواست تماس
    this.rtcSocket.on('incoming_call', async (data) => {
        console.log('📞 Incoming call from:', data.fromUsername);
        
        const accept = confirm(`📞 ${data.fromUsername} با شما تماس می‌گیرد. قبول کنید؟`);
        
        if (accept) {
            try {
                this.selectedUser = { id: data.from, username: data.fromUsername };
                await this.setupPeerConnection(false, data.offer);
                
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.rtcSocket.emit('accept_call', {
                    to: data.from,
                    answer: answer
                });

                this.showCallUI();
                this.showMessage('سیستم', `📞 تماس با ${data.fromUsername} برقرار شد`, 'other');
            } catch (error) {
                console.error('❌ Error accepting call:', error);
                alert('خطا در برقراری تماس');
                this.rtcSocket.emit('reject_call', { to: data.from });
            }
        } else {
            this.rtcSocket.emit('reject_call', { to: data.from });
            this.showMessage('سیستم', `📞 تماس از ${data.fromUsername} رد شد`, 'other');
        }
    });

    // تماس قبول شد
    this.rtcSocket.on('call_accepted', async (data) => {
        console.log('✅ Call accepted by remote user');
        try {
            await this.peerConnection.setRemoteDescription(data.answer);
            this.showMessage('سیستم', '📞 کاربر تماس را قبول کرد', 'other');
        } catch (error) {
            console.error('❌ Error setting remote description:', error);
        }
    });

    // تماس رد شد
    this.rtcSocket.on('call_rejected', () => {
        console.log('❌ Call rejected by remote user');
        alert('📞 کاربر تماس را رد کرد');
        this.hideCallUI();
        this.showMessage('سیستم', '📞 کاربر تماس را رد کرد', 'other');
    });

    // تماس قطع شد
    this.rtcSocket.on('call_ended', () => {
        console.log('🚪 Call ended by remote user');
        this.showMessage('سیستم', '📞 تماس قطع شد', 'other');
        this.hideCallUI();
        this.cleanupCall();
    });

    // دریافت کاندید ICE
    this.rtcSocket.on('ice_candidate', async (data) => {
        if (data.candidate) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ ICE candidate added');
            } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
            }
        }
    });

    // خطا در تماس
    this.rtcSocket.on('call_failed', (data) => {
        console.error('❌ Call failed:', data.message);
        alert(`خطا در تماس: ${data.message}`);
        this.hideCallUI();
        this.cleanupCall();
    });
}

    // 💬 مدیریت پیام‌ها
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();

        if (!content || !this.selectedUser) {
            this.showMessage('سیستم', 'لطفا کاربری را انتخاب کنید و پیام بنویسید', 'other');
            return;
        }
        console.log("Selected user id ",this.selectedUser.userId)
        this.socket.emit('send_message', {
            content: content,
            receiverId: this.selectedUser.userId,
            type: 'private'
        });

        // نمایش پیام خود کاربر
        this.showMessage('شما', content, 'own');
        
        messageInput.value = '';
    }

   showMessage(sender, content, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    
    messageElement.className = `message ${type}`;
    messageElement.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div>${content}</div>
        <div class="message-time">${new Date().toLocaleTimeString('fa-IR')}</div>
    `;

    messagesContainer.appendChild(messageElement);
    
    // اسکرول به پایین با تاخیر برای اطمینان از رندر شدن
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
}

    // 👥 مدیریت کاربران آنلاین
    updateOnlineUsers(users) {
        const usersList = document.getElementById('onlineUsersList');
        usersList.innerHTML = '';

        users.forEach(user => {
            if (user.userId !== this.currentUser.id) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.innerHTML = `
                    <span>${user.username}</span>
                    <div class="user-online"></div>
                `;
                
                userElement.onclick = () => this.selectUser(user);
                usersList.appendChild(userElement);
            }
        });
    }

   selectUser(user) {
    console.log("inselect user ",user)
    this.selectedUser = user;
    document.getElementById('chatTitle').textContent = `چت با ${user.username}`;
    document.getElementById('callControls').classList.remove('hidden');
    
    // پاک کردن پیام‌های قبلی
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    // دریافت تاریخچه چت
    this.socket.emit('get_chat_history', {
        otherUserId: user.userId,
        type: 'private'
    });

    this.showMessage('سیستم', `شما با ${user.username} چت می‌کنید`, 'other');
}
    // 📞 مدیریت تماس ویدیویی
    async startCall() {
        if (!this.selectedUser) {
            alert('لطفا کاربری را انتخاب کنید');
            return;
        }
 console.log('📞 Starting call to:', this.selectedUser);
    console.log('📞 WebRTC socket connected?', this.rtcSocket?.connected);

        try {
            await this.setupPeerConnection(true);
            await this.getUserMedia();
            
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
        console.log('📞 Emitting call_user event...');

            this.rtcSocket.emit('call_user', {
                to: this.selectedUser.userId,
                offer: offer,
                from: this.currentUser.id,
                fromUsername: this.currentUser.username
            });

            this.showCallUI();
                    console.log('📞 Call request sent');

            
        } catch (error) {
            console.error('Error starting call:', error);
            alert('خطا در برقراری تماس');
        }
    }

    async setupPeerConnection(isCaller, offer = null) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // اضافه کردن استریم محلی
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // دریافت استریم ریموت
        this.peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            }
        };

        // مدیریت ICE Candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.selectedUser) {
                this.rtcSocket.emit('ice_candidate', {
                    to: this.selectedUser.userId,
                    candidate: event.candidate
                });
            }
        };

        // تنظیم offer ریموت اگر کالر نیستیم
        if (!isCaller && offer) {
            await this.peerConnection.setRemoteDescription(offer);
        }
    }

    async getUserMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('دسترسی به دوربین و میکروفون امکان‌پذیر نیست');
        }
    }

    endCall() {
        if (this.selectedUser) {
            this.rtcSocket.emit('end_call', { to: this.selectedUser.userId });
        }
        this.hideCallUI();
        this.cleanupCall();
    }

    showCallUI() {
        document.getElementById('videoSection').classList.remove('hidden');
        document.getElementById('chatTitle').textContent = '📞 در حال تماس...';
    }

    hideCallUI() {
        document.getElementById('videoSection').classList.add('hidden');
        if (this.selectedUser) {
            document.getElementById('chatTitle').textContent = `چت با ${this.selectedUser.username}`;
        }
    }

    cleanupCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }

    // 🎯 سایر متدها
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.textContent = '🟢 متصل';
            statusElement.className = 'status connected';
        } else {
            statusElement.textContent = '🔴 قطع';
            statusElement.className = 'status disconnected';
        }
    }

    logout() {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('user_info');
        
        if (this.socket) {
            this.socket.disconnect();
        }
        if (this.rtcSocket) {
            this.rtcSocket.disconnect();
        }

        this.currentUser = null;
        this.selectedUser = null;
        
        // بازگرداندن UI به حالت اول
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('userInfoSection').classList.add('hidden');
        document.getElementById('callControls').classList.add('hidden');
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendButton').disabled = true;
        
        this.showMessage('سیستم', 'شما از سیستم خارج شدید', 'other');
    }
}

// 📝 توابع全局 برای استفاده در HTML
let chatApp;

// وقتی صفحه لود شد
window.onload = function() {
    chatApp = new ChatApp();
};

function register() {
    chatApp.register();
}

function login() {
    chatApp.login();
}

function logout() {
    chatApp.logout();
}

function sendMessage() {
    chatApp.sendMessage();
}

function startCall() {
    chatApp.startCall();
}

function endCall() {
    chatApp.endCall();
}