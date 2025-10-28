<template>
  <div class="min-h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25">
    <!-- Loading State -->
    <div v-if="isLoading && !campaign" class="flex items-center justify-center min-h-screen">
      <div class="bg-white/90 backdrop-blur-sm p-8 rounded-xl border border-orange-100/50 shadow-sm text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading campaign...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm max-w-md w-full">
        <div class="flex items-center space-x-3">
          <IconAlertCircle class="w-6 h-6 text-red-600" />
          <div>
            <h3 class="text-lg font-semibold text-red-800 mb-1">Campaign Not Found</h3>
            <p class="text-red-700">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Campaign Content -->
    <div v-else-if="campaign" class="relative">
      <!-- Hero Header Section -->
      <div class="relative">
        <!-- Campaign Image -->
        <div class="h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100">
          <img 
            v-if="campaign.image"
            :src="campaign.image" 
            :alt="campaign.title"
            class="w-full h-full object-cover"
            @error="$event.target.style.display = 'none'"
          />
          <img 
            v-else
            src="/ZapTracker_campaigns.png" 
            alt="ZapTracker Campaign"
            class="w-full h-full object-cover opacity-80"
          />
          
          <!-- Gradient Overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
        </div>
        
        <!-- Campaign Info Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
          <div class="max-w-4xl mx-auto">
            <!-- ZapTracker Branding -->
            <div class="flex items-center space-x-2 mb-4">
              <img 
                src="/new_logo3.png"
                alt="ZapTracker Logo" 
                class="w-8 h-8 object-contain"
              />
              <span class="text-lg font-semibold text-white/90">ZapTracker</span>
            </div>
            
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">{{ campaign.title }}</h1>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 p-4 sm:p-6 -mt-12 relative z-10">
        <!-- Left Column: Campaign Details & Supporters -->
        <div class="lg:col-span-3 space-y-6">
          <!-- Compact Campaign Header Card -->
          <div class="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-orange-100/50 shadow-lg">
            <!-- Campaign Title & Meta in Single Row -->
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div class="flex-1 min-w-0">
                <h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight mb-2">{{ campaign.title }}</h1>
                <!-- Campaign Description with Read More/Less -->
                <div class="text-sm sm:text-base text-gray-600 leading-relaxed">
                  <p v-if="!showFullDescription && campaign.summary.length > 150" class="mb-2">
                    {{ campaign.summary.substring(0, 150) }}...
                    <button 
                      @click="showFullDescription = true"
                      class="text-orange-600 hover:text-orange-700 font-medium ml-1 transition-colors"
                    >
                      Read more
                    </button>
                  </p>
                  <p v-else class="mb-2">
                    {{ campaign.summary }}
                    <button 
                      v-if="campaign.summary.length > 150"
                      @click="showFullDescription = false"
                      class="text-orange-600 hover:text-orange-700 font-medium ml-1 transition-colors"
                    >
                      Read less
                    </button>
                  </p>
                </div>
              </div>
              
              <!-- Compact Status Indicators -->
              <div class="flex flex-row sm:flex-col gap-2 sm:gap-1 flex-shrink-0">
                <span :class="[
                  'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                  statusColor
                ]">
                  {{ status.charAt(0).toUpperCase() + status.slice(1) }}
                </span>
                
                <div v-if="daysRemaining !== 'No deadline'" class="flex items-center space-x-1 bg-orange-50 px-3 py-1 rounded-full">
                  <IconClock class="w-3 h-3 text-orange-600" />
                  <span class="text-xs font-medium text-orange-800 whitespace-nowrap">{{ daysRemaining }}</span>
                </div>
              </div>
            </div>
            
            <!-- Clean Campaign Progress Section -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <!-- Header with Progress Percentage -->
              <div class="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                <h2 class="text-lg font-semibold text-gray-900">Campaign Progress</h2>
                <div class="text-2xl font-bold text-orange-600">{{ progress.percentage }}%</div>
              </div>
              
              <!-- Progress Bar -->
              <div class="p-4 pb-3">
                <div class="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    class="bg-gradient-to-r from-orange-400 to-amber-400 h-3 rounded-full transition-all duration-700 ease-out"
                    :style="{ width: `${Math.min(progress.percentage, 100)}%` }"
                  ></div>
                </div>
                
                <!-- Stats Row -->
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center space-x-4">
                    <div>
                      <span class="font-semibold text-gray-900">{{ formatCurrency(progress.current) }}</span>
                      <span class="text-gray-500 ml-1">raised</span>
                    </div>
                    <div class="w-px h-4 bg-gray-300"></div>
                    <div>
                      <span class="font-semibold text-gray-900">{{ totalZapCount }}</span>
                      <span class="text-gray-500 ml-1">supporter{{ totalZapCount !== 1 ? 's' : '' }}</span>
                    </div>
                  </div>
                  <div>
                    <span class="font-semibold text-gray-900">{{ formatCurrency(progress.goal) }}</span>
                    <span class="text-gray-500 ml-1">goal</span>
                  </div>
                </div>
              </div>
              
              <!-- Time Remaining (if applicable) -->
              <div v-if="daysRemaining !== 'No deadline'" class="px-4 pb-4">
                <div class="flex items-center justify-center space-x-2 bg-amber-50 px-3 py-2 rounded-lg">
                  <IconClock class="w-4 h-4 text-amber-600" />
                  <span class="text-sm font-medium text-amber-700">{{ daysRemaining }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Progress Section -->

          <!-- Compact Supporters Section -->
          <div class="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-orange-100/50 shadow-lg">
            <!-- Enhanced Supporters Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <IconUsers class="w-5 h-5 text-orange-600" />
                <span>Supporters</span>
                <span v-if="totalZapCount > 0" class="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {{ totalZapCount }} supporter{{ totalZapCount !== 1 ? 's' : '' }}
                </span>
              </h3>
            </div>
            
            <div v-if="recentZaps.length === 0" class="text-center py-12">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconUsers class="w-8 h-8 text-gray-400" />
              </div>
              <h4 class="text-lg font-medium text-gray-900 mb-2">Be the First Supporter!</h4>
              <p class="text-gray-600">Your contribution will help kickstart this campaign</p>
            </div>
            
            <div v-else class="space-y-4">
              <!-- Enhanced Supporter Grid - Show Latest 7 -->
              <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-4">
                <div 
                  v-for="(zap, index) in displayedSupporters" 
                  :key="zap.id"
                  class="group relative text-center transform hover:scale-110 transition-all duration-200"
                >
                  <!-- Major Supporter (10k+ sats) -->
                  <div 
                    v-if="zap.amount >= 10000"
                    class="relative"
                  >
                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-3 border-yellow-400 shadow-lg mx-auto relative">
                      <img 
                        :src="getSenderAvatar(zap)" 
                        :alt="zap.sender?.name || 'Supporter'"
                        class="w-full h-full object-cover"
                        @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                      />
                      <div class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm">
                        <IconBolt class="w-3 h-3 text-yellow-800" />
                      </div>
                    </div>
                    <div class="mt-2">
                      <div class="font-bold text-yellow-600 text-sm">{{ formatZapAmount(zap.amount) }}</div>
                      <div class="text-xs text-gray-600 truncate max-w-full font-medium" :title="getSenderName(zap)">
                        {{ getSenderName(zap) }}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Regular Supporter -->
                  <div 
                    v-else
                    class="relative"
                  >
                    <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-orange-200 shadow-md mx-auto">
                      <img 
                        :src="getSenderAvatar(zap)" 
                        :alt="zap.sender?.name || 'Supporter'"
                        class="w-full h-full object-cover"
                        @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                      />
                    </div>
                    <div class="mt-2">
                      <div class="font-semibold text-orange-600 text-sm">{{ formatZapAmount(zap.amount) }}</div>
                      <div class="text-xs text-gray-600 truncate max-w-full font-medium" :title="getSenderName(zap)">
                        {{ getSenderName(zap) }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Show More Supporters Indicator -->
                <div 
                  v-if="totalZapCount > 7"
                  class="group relative text-center transform hover:scale-110 transition-all duration-200 cursor-pointer"
                  @click="showAllSupporters = !showAllSupporters"
                >
                  <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 mx-auto flex items-center justify-center">
                    <IconUsers class="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
                  </div>
                  <div class="mt-2">
                    <div class="font-semibold text-gray-500 text-sm group-hover:text-gray-700">+{{ totalZapCount - 7 }}</div>
                    <div class="text-xs text-gray-500 font-medium group-hover:text-gray-600">
                      {{ showAllSupporters ? 'Show less' : 'more' }}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Total Support Summary -->
              <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mt-6">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-green-800">{{ formatCurrency(totalZapAmount) }}</div>
                    <div class="text-sm text-green-600">Total Support Received</div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-green-800">{{ totalZapCount }}</div>
                    <div class="text-sm text-green-600">Supporters</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Campaign Description -->
          <div v-if="campaign.descriptionLong" class="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-orange-100/50 shadow-lg">
            <h3 class="text-lg font-bold text-gray-900 mb-3">About This Campaign</h3>
            <div class="prose prose-sm prose-gray max-w-none">
              <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ campaign.descriptionLong }}</p>
            </div>
          </div>

          <!-- Campaign Details -->
          <div class="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-orange-100/50 shadow-lg">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Campaign Details</h3>
            
            <div class="space-y-3">
              <!-- Author -->
              <div v-if="campaignAuthor" class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Created by:</span>
                <div 
                  @click="openUserProfile"
                  class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors"
                >
                  <img 
                    :src="campaignAuthor.picture" 
                    :alt="campaignAuthor.name"
                    class="w-5 h-5 rounded-full object-cover"
                    @error="$event.target.src = generateAvatar(campaignAuthor.pubkey)"
                  />
                  <span class="text-sm font-medium text-gray-900">{{ campaignAuthor.name }}</span>
                </div>
              </div>
              
              <!-- Event ID -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Event ID (NIP-75):</span>
                <div class="flex items-center space-x-2">
                  <code class="text-xs bg-gray-100 px-2 py-0.5 rounded">{{ campaign.id.substring(0, 8) }}...{{ campaign.id.substring(campaign.id.length - 8) }}</code>
                  <button
                    @click="copyToClipboard(campaign.id, 'eventId')"
                    class="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    <IconCheck v-if="copySuccess === 'eventId'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <!-- View in Nostr Client -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">View in Nostr client:</span>
                <div class="flex items-center space-x-2">
                  <a 
                    :href="`https://primal.net/e/${campaign.id}`" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="text-xs text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <IconExternalLink class="w-3 h-3" />
                    <span>Primal</span>
                  </a>
                  <a 
                    :href="`https://yakihonne.com/e/${campaign.id}`" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <IconMessageCircle class="w-3 h-3" />
                    <span>Yakihonne</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Payment Section -->
        <div class="lg:col-span-2">
          <div class="sticky top-6">
            <!-- Payment Card -->
            <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg overflow-hidden">
              <!-- Payment Header -->
              <div class="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 sm:p-6">
                <h3 class="text-lg sm:text-xl font-bold mb-2 flex items-center space-x-2">
                  <IconBolt class="w-6 h-6" />
                  <span>Support This Campaign</span>
                </h3>
                <p class="text-orange-100">Every sat counts towards the goal</p>
              </div>

              <!-- Payment Content -->
              <div class="p-4 sm:p-6">
                <!-- Amount Selection (Step 1) -->
                <div v-if="currentStep === 'amount'" class="space-y-4">
                  <!-- Quick Amount Selection -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-3">Choose Amount</label>
                    <div class="grid grid-cols-2 gap-3 mb-4">
                      <button
                        v-for="amount in predefinedAmounts"
                        :key="amount.value"
                        @click="selectAmount(amount.value)"
                        :class="[
                          'p-3 rounded-xl border-2 text-center transition-all duration-200 hover:scale-105',
                          !isCustomAmount && zapAmount === amount.value
                            ? 'border-orange-400 bg-orange-50 shadow-md'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-25'
                        ]"
                      >
                        <div class="font-bold text-gray-900 text-sm">{{ amount.label }}</div>
                        <div class="text-xs text-gray-500">{{ amount.description }}</div>
                      </button>
                    </div>
                    
                    <!-- Custom Amount -->
                    <div class="space-y-2">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          :checked="isCustomAmount"
                          @change="toggleCustomAmount"
                          class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <label class="ml-2 text-sm font-medium text-gray-700">Custom amount</label>
                      </div>
                      
                      <div v-if="isCustomAmount" class="relative">
                        <input
                          v-model.number="customAmount"
                          type="number"
                          min="1"
                          placeholder="Enter sats"
                          class="w-full px-3 py-2 pr-12 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:ring-0 transition-colors text-base font-medium"
                        />
                        <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                          <span class="text-sm font-medium text-gray-500">sats</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Comment -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Message (optional)</label>
                    <textarea
                      v-model="zapComment"
                      rows="2"
                      placeholder="Add an encouraging message..."
                      class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:ring-0 transition-colors resize-none text-sm"
                    ></textarea>
                  </div>
                  
                  <!-- Continue Button -->
                  <button
                    @click="generateInvoice"
                    :disabled="!canProceed || isGeneratingInvoice"
                    class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <IconLoader v-if="isGeneratingInvoice" class="w-5 h-5 animate-spin" />
                    <IconBolt v-else class="w-5 h-5" />
                    <span>{{ isGeneratingInvoice ? 'Creating Invoice...' : `Support with ${effectiveAmount.toLocaleString()} sats` }}</span>
                  </button>
                </div>

                <!-- Payment Options (Step 2) -->
                <div v-else-if="currentStep === 'payment' && invoice" class="space-y-4">
                  <!-- Amount Summary -->
                  <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-orange-800">Supporting with:</span>
                      <span class="text-lg font-bold text-orange-600">{{ effectiveAmount.toLocaleString() }} sats</span>
                    </div>
                    <div v-if="zapComment" class="mt-2 pt-2 border-t border-orange-200">
                      <p class="text-xs text-orange-700 italic">"{{ zapComment }}"</p>
                    </div>
                  </div>

                  <!-- QR Code -->
                  <div class="text-center">
                    <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block shadow-sm">
                      <div v-if="!invoice" class="w-[200px] h-[200px] flex items-center justify-center">
                        <IconLoader class="w-8 h-8 animate-spin text-orange-500" />
                      </div>
                      <QRCodeVue3
                        v-else
                        :value="`lightning:${invoice}`"
                        :size="180"
                        color="#000000"
                        background-color="#ffffff"
                        error-correction-level="M"
                      />
                    </div>
                    <p class="text-sm text-gray-600 mt-3">Scan with any Lightning wallet</p>
                  </div>
                  
                  <!-- Payment Buttons -->
                  <div class="space-y-2">
                    <!-- Pay with ZapTracker Wallet -->
                    <button
                      v-if="isWalletConnected"
                      @click="payWithInternalNWC"
                      :disabled="isProcessingPayment"
                      class="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <IconLoader v-if="isProcessingPayment" class="w-5 h-5 animate-spin" />
                      <IconWallet v-else class="w-5 h-5" />
                      <span>{{ isProcessingPayment ? 'Processing Payment...' : 'Pay with ZapTracker Wallet' }}</span>
                    </button>
                    
                    <!-- Open in External Wallet -->
                    <button
                      @click="openExternalWallet"
                      class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <IconExternalLink class="w-5 h-5" />
                      <span>Open in Wallet</span>
                    </button>
                  </div>
                  
                  <!-- Back Button -->
                  <div class="text-center pt-3 border-t border-gray-200">
                    <button 
                      @click="resetToAmountSelection" 
                      class="text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center space-x-1 mx-auto"
                    >
                      <IconArrowLeft class="w-4 h-4" />
                      <span>Change Amount</span>
                    </button>
                  </div>
                </div>

                <!-- Success State -->
                <div v-else-if="paymentStatus === 'success'" class="text-center py-6">
                  <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconCheck class="w-8 h-8 text-green-600" />
                  </div>
                  <h4 class="text-xl font-semibold text-green-600 mb-2">Thank You! 🎉</h4>
                  <p class="text-gray-600 mb-4">Your {{ effectiveAmount.toLocaleString() }} sats contribution makes a difference!</p>
                  <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3">
                    <p class="text-orange-800 font-medium">
                      🚀 Your support helps bring this campaign closer to its goal
                    </p>
                  </div>
                </div>

                <!-- Error State -->
                <div v-else-if="paymentStatus === 'error'" class="space-y-4">
                  <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconAlertCircle class="w-8 h-8 text-red-600" />
                    </div>
                    <h4 class="text-lg font-semibold text-red-800 mb-2">Payment Failed</h4>
                    <p class="text-sm text-red-700 mb-4">{{ paymentError }}</p>
                    <button 
                      @click="resetToAmountSelection" 
                      class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 mx-auto"
                    >
                      <IconBolt class="w-4 h-4" />
                      <span>Try Again</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Trust Indicators -->
            <div class="mt-4 bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-lg p-3">
              <div class="flex items-start space-x-3">
                <IconShield class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-semibold text-blue-900 text-sm mb-1">Secure Lightning Payments</h4>
                  <p class="text-blue-800 text-xs leading-relaxed">
                    Powered by Bitcoin Lightning Network. Your payment is processed instantly and securely.
                  </p>
                </div>
              </div>
            </div>

            <!-- ZapTracker Branding -->
            <div class="mt-4 text-center">
              <a
                href="/"
                class="inline-flex items-center space-x-2 text-orange-600 hover:text-orange-700 font-medium text-xs bg-white/60 hover:bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors border border-orange-200/50"
              >
                <img 
                  src="/new_logo3.png"
                  alt="ZapTracker" 
                  class="w-3 h-3 object-contain"
                />
                <span>Powered by ZapTracker</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <CampaignShareModal
      v-if="showShareModal && campaign"
      :campaign="campaign"
      :isAuthenticated="isAuthenticated"
      @close="showShareModal = false"
    />

    <!-- User Profile Modal -->
    <UserProfileModal
      v-if="showUserModal && campaignAuthor"
      :show="showUserModal"
      :user-profile-data="{ pubkey: campaignAuthor.pubkey, profile: campaignAuthor }"
      @close="showUserModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { generateAvatar } from '../utils/avatarGenerator.js'
import { 
  IconTarget, 
  IconBolt, 
  IconCalendar, 
  IconUsers, 
  IconShare,
  IconArrowLeft,
  IconLoader,
  IconAlertCircle,
  IconClock,
  IconCheck,
  IconX,
  IconExternalLink,
  IconCopy,
  IconUser,
  IconMessageCircle,
  IconWallet,
  IconShield
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrConnections } from '../composables/useNostrConnections.js'
import { useNotifications } from '../composables/useNotifications.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { makeZapRequest } from 'nostr-tools/nip57'
import { payInvoice } from '../utils/nwcClient.js'
import { bech32 } from '@scure/base'
import * as nip19 from 'nostr-tools/nip19'
import CampaignShareModal from '../components/CampaignShareModal.vue'
import UserProfileModal from '../components/UserProfileModal.vue'

// Get changePage function from parent
const changePage = inject('changePage')

// Use composables
const { 
  fetchCampaignById, 
  getCampaignProgress, 
  isCampaignExpired, 
  isCampaignCompleted, 
  getCampaignStatus,
  campaignAggregatedZaps: campaignZapsMap,
  isLoading,
  error
} = useCampaigns()
const { isAuthenticated, currentUser } = useNostrAuth()
const { isWalletConnected } = useNostrConnections()
const { handleZapSent, handlePaymentSuccess, handlePaymentError } = useNotifications()

// State
const campaign = ref(null)
const campaignAuthor = ref(null)
const showShareModal = ref(false)
const showUserModal = ref(false)
const copySuccess = ref('')
const showFullDescription = ref(false)
const showAllSupporters = ref(false)

// Payment state
const zapAmount = ref(1000) // Default 1000 sats
const customAmount = ref(null)
const zapComment = ref('')
const isCustomAmount = ref(false)
const isGeneratingInvoice = ref(false)
const isProcessingPayment = ref(false)
const paymentError = ref('')
const invoice = ref('')
const paymentStatus = ref('') // pending, success, error
const currentStep = ref('amount') // amount, payment

// Predefined amounts
const predefinedAmounts = [
  { value: 1000, label: '1K', description: 'Small boost' },
  { value: 5000, label: '5K', description: 'Good support' },
  { value: 10000, label: '10K', description: 'Strong support' },
  { value: 21000, label: '21K', description: 'Bitcoin tribute' }
]

// Get event ID from URL params
const getEventIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('eventId')
}

// Load campaign
const loadCampaign = async () => {
  const eventId = getEventIdFromUrl()
  
  if (!eventId) {
    console.error('No eventId found in URL parameters')
    changePage('campaign-not-found')
    return
  }
  
  console.log('Attempting to load campaign with eventId:', eventId)
  
  try {
    const loadedCampaign = await fetchCampaignById(eventId)
    console.log('Campaign loaded successfully:', loadedCampaign)
    campaign.value = loadedCampaign
    
    // Fetch author profile
    await fetchAuthorProfile(loadedCampaign.pubkey)
  } catch (err) {
    console.error('Failed to load campaign:', err)
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      eventId: eventId
    })
    changePage('campaign-not-found')
  }
}

// Fetch author profile
const fetchAuthorProfile = async (pubkey) => {
  try {
    const authorEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [pubkey],
      limit: 1
    })
    
    if (authorEvent) {
      try {
        const profile = JSON.parse(authorEvent.content)
        campaignAuthor.value = {
          pubkey,
          name: profile.name || profile.display_name || `user:${pubkey.substring(0, 8)}`,
          picture: profile.picture || generateAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null,
          lud16: profile.lud16 || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        campaignAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateAvatar(pubkey)
        }
      }
    } else {
      campaignAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    campaignAuthor.value = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey)
    }
  }
}


// Calculate progress
const progress = computed(() => {
  if (!campaign.value) return { current: 0, goal: 0, percentage: 0 }
  return getCampaignProgress(campaign.value.id)
})

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  
  try {
    // Convert from millisats to sats
    const sats = Math.floor(amount / 1000)
    return sats ? sats.toLocaleString() : '0'
  } catch (error) {
    console.error('Error formatting amount:', error, amount)
    return '0'
  }
}

// Enhanced currency formatting with K/M suffixes
const formatCurrency = (amount) => {
  if (!amount) return '0 sats'
  
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M sats`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K sats`
  }
  return `${amount.toLocaleString()} sats`
}
// Calculate days remaining
const daysRemaining = computed(() => {
  if (!campaign.value || !campaign.value.closedAt) return 'No deadline'
  
  const now = Math.floor(Date.now() / 1000)
  const remaining = campaign.value.closedAt - now
  
  if (remaining <= 0) return 'Ended'
  
  const days = Math.floor(remaining / (60 * 60 * 24))
  return days === 1 ? '1 day left' : `${days} days left`
})

// Get campaign status
const status = computed(() => {
  if (!campaign.value) return 'loading'
  return getCampaignStatus(campaign.value)
})

// Get status color
const statusColor = computed(() => {
  switch (status.value) {
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'expired':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-orange-100 text-orange-700'
  }
})

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

// Get recent zaps from campaign aggregated zaps
const recentZaps = computed(() => {
  if (!campaign.value) return []
  
  // Get zaps from the campaign aggregated zaps system using the reactive Map
  const campaignZaps = campaignZapsMap.value.get(campaign.value.id) || []
  
  console.log(`🔍 CampaignView: Campaign ${campaign.value.id.substring(0, 8)}... has ${campaignZaps.length} zaps`)
  console.log('🔍 CampaignView: Campaign zaps data:', campaignZaps.map(zap => ({
    id: zap.id.substring(0, 8) + '...',
    amount: zap.amount,
    sender: zap.sender?.name || 'Unknown',
    picture: zap.sender?.picture || 'No picture'
  })))
  
  return campaignZaps
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by most recent first
    .map(zap => ({
      ...zap,
      timeAgo: formatTimeAgo(zap.timestamp)
    }))
})

// Display exactly 7 supporters or all if showAllSupporters is true
const displayedSupporters = computed(() => {
  if (showAllSupporters.value) {
    return recentZaps.value
  }
  return recentZaps.value.slice(0, 7)
})
// Get total zap count for this campaign
const totalZapCount = computed(() => {
  if (!campaign.value) return 0
  const campaignZaps = campaignZapsMap.value.get(campaign.value.id) || []
  return campaignZaps.length
})

// Get total zap amount for this campaign
const totalZapAmount = computed(() => {
  if (!campaign.value) return 0
  const campaignZaps = campaignZapsMap.value.get(campaign.value.id) || []
  return campaignZaps.reduce((sum, zap) => sum + zap.amount, 0)
})

const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Payment logic
const effectiveAmount = computed(() => {
  return isCustomAmount.value ? (customAmount.value || 0) : zapAmount.value
})

const isValidAmount = computed(() => {
  return effectiveAmount.value > 0
})

const canProceed = computed(() => {
  return isAuthenticated.value && isValidAmount.value && !isGeneratingInvoice.value
})

// Watch for custom amount changes
watch(customAmount, (newValue) => {
  if (newValue) {
    isCustomAmount.value = true
  }
})

// Reset form to initial state
const resetForm = () => {
  zapAmount.value = 1000
  customAmount.value = null
  zapComment.value = ''
  isCustomAmount.value = false
  paymentError.value = ''
  invoice.value = ''
  paymentStatus.value = ''
  currentStep.value = 'amount'
  isGeneratingInvoice.value = false
  isProcessingPayment.value = false
}

// Reset to amount selection (from payment view)
const resetToAmountSelection = () => {
  currentStep.value = 'amount'
  paymentError.value = ''
  paymentStatus.value = ''
  invoice.value = ''
  isGeneratingInvoice.value = false
  isProcessingPayment.value = false
}

// Select predefined amount
const selectAmount = (amount) => {
  zapAmount.value = amount
  isCustomAmount.value = false
  customAmount.value = null
}

// Toggle custom amount
const toggleCustomAmount = () => {
  isCustomAmount.value = !isCustomAmount.value
  if (isCustomAmount.value && !customAmount.value) {
    customAmount.value = zapAmount.value
  }
}

// Generate Lightning invoice via NIP-57
const generateInvoice = async () => {
  if (!canProceed.value) return
  
  isGeneratingInvoice.value = true
  paymentError.value = ''
  paymentStatus.value = ''
  
  try {
    console.log('Generating zap invoice for campaign:', campaign.value.id)
    
    // Get author's profile metadata to extract zap endpoint
    const profileEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [campaignAuthor.value.pubkey],
      limit: 1
    })
    
    if (!profileEvent) {
      throw new Error('Could not find author profile')
    }
    
    // Get zap endpoint using proper nostr-tools implementation
    const zapEndpoint = await getZapEndpoint(profileEvent)
    
    if (!zapEndpoint) {
      throw new Error('Author does not have a zap endpoint configured')
    }
    
    console.log('Using zap endpoint:', zapEndpoint)
    
    // Create zap request
    const zapRequest = makeZapRequest({
      profile: campaignAuthor.value.pubkey,
      event: campaign.value.rawEvent,
      amount: effectiveAmount.value * 1000, // Convert to millisats
      comment: zapComment.value ? 
        `${zapComment.value} (Campaign: ${campaign.value.title})` : 
        `Supporting campaign: ${campaign.value.title}`,
      relays: campaign.value.relays || [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://relay.primal.net',
        'wss://nostr-01.yakihonne.com',
      ]
    })
    
    // CRITICAL: Add goal and event tags for proper campaign tracking
    if (!zapRequest.tags) {
      zapRequest.tags = []
    }
    
    // Add goal tag for NIP-75 campaign tracking
    zapRequest.tags.push(['goal', campaign.value.id])
    
    // Add event tag to reference the campaign
    zapRequest.tags.push(['e', campaign.value.id])
    
    console.log('Created zap request:', zapRequest)
    
    // Get invoice from zap endpoint
    const zapRequestString = JSON.stringify(zapRequest)
    const encodedZapRequest = encodeURIComponent(zapRequestString)
    const zapEndpointUrl = `${zapEndpoint}?amount=${effectiveAmount.value * 1000}&nostr=${encodedZapRequest}`
    
    console.log('Requesting invoice from zap endpoint:', zapEndpointUrl)
    
    const response = await fetch(zapEndpointUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Zap endpoint error response:', errorText)
      throw new Error(`Zap endpoint returned ${response.status}: ${errorText}`)
    }
    
    const zapEndpointResponse = await response.json()
    console.log('Zap endpoint response:', zapEndpointResponse)
    
    if (!zapEndpointResponse.pr) {
      console.error('Zap endpoint response:', zapEndpointResponse)
      throw new Error('No payment request in zap endpoint response')
    }
    
    console.log('Setting invoice:', zapEndpointResponse.pr)
    invoice.value = zapEndpointResponse.pr
    currentStep.value = 'payment'
    console.log('Invoice generated successfully, transitioning to payment view')
    
  } catch (err) {
    console.error('Failed to generate invoice:', err)
    paymentError.value = err.message || 'Failed to generate invoice'
    paymentStatus.value = 'error'
  } finally {
    isGeneratingInvoice.value = false
  }
}

// Pay with internal NWC wallet
const payWithInternalNWC = async () => {
  if (!invoice.value || !isWalletConnected.value) return
  
  isProcessingPayment.value = true
  paymentError.value = ''
  
  try {
    console.log('Paying with internal NWC wallet...')
    
    const paymentResult = await payInvoice({
      invoice: invoice.value
    })
    
    console.log('Internal NWC payment successful:', paymentResult)
    paymentStatus.value = 'success'
    
    // Notify about successful payment
    handlePaymentSuccess(paymentResult)
    handleZapSent({ 
      amount: effectiveAmount.value,
      recipient: campaignAuthor.value.name || 'Campaign Author'
    })
    
    // Reset form after 4 seconds
    setTimeout(() => {
      resetForm()
    }, 4000)
    
  } catch (err) {
    console.error('Internal NWC payment failed:', err)
    paymentError.value = err.message || 'Payment failed'
    paymentStatus.value = 'error'
    handlePaymentError(err)
  } finally {
    isProcessingPayment.value = false
  }
}

// Open in external wallet
const openExternalWallet = () => {
  if (!invoice.value) return
  
  try {
    console.log('Opening invoice in external wallet...')
    
    // Create lightning: URI and attempt to open it
    const lightningUri = `lightning:${invoice.value}`
    window.open(lightningUri, '_blank')
    
    console.log('Lightning URI opened:', lightningUri)
    
  } catch (err) {
    console.error('Failed to open external wallet:', err)
    paymentError.value = 'Failed to open external wallet'
  }
}

// Proper getZapEndpoint implementation based on nostr-tools
async function getZapEndpoint(metadata) {
  try {
    let lnurl = ''
    const profile = JSON.parse(metadata.content)
    const { lud06, lud16 } = profile
    
    if (lud06) {
      // Decode bech32 lud06 to get LNURL
      try {
        const { words } = bech32.decode(lud06, 1000)
        const data = bech32.fromWords(words)
        lnurl = new TextDecoder().decode(new Uint8Array(data))
      } catch (decodeError) {
        console.error('Failed to decode lud06:', decodeError)
        throw new Error('Invalid lud06 format')
      }
    } else if (lud16) {
      // Convert lightning address to LNURL
      const [name, domain] = lud16.split('@')
      if (!name || !domain) {
        throw new Error('Invalid lightning address format')
      }
      lnurl = `https://${domain}/.well-known/lnurlp/${name}`
    } else {
      return null
    }
    
    console.log('Resolved LNURL:', lnurl)
    
    // Fetch LNURL metadata
    const response = await fetch(lnurl)
    if (!response.ok) {
      throw new Error(`LNURL endpoint returned ${response.status}`)
    }
    
    const body = await response.json()
    console.log('LNURL response:', body)
    
    // Check for NIP-57 zap compatibility
    if (body.allowsNostr && body.nostrPubkey) {
      console.log('Zap endpoint found:', body.callback)
      return body.callback
    } else {
      console.log('LNURL endpoint does not support zaps')
      return null
    }
  } catch (err) {
    console.error('Failed to get zap endpoint:', err)
    throw err
  }
}

// Format zap amount for display
const formatZapAmount = (amount) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toString()
}

// Get sender name with fallback
const getSenderName = (zap) => {
  // Prioritize fetched profile data
  if (zap.sender?.name) {
    return zap.sender.name
  }
  
  // Check for display_name (Nostr standard)
  if (zap.sender?.display_name) {
    return zap.sender.display_name
  }
  
  // Fallback to pubkey
  if (zap.zapperPubkey) {
    return `user:${zap.zapperPubkey.substring(0, 8)}`
  }
  
  return 'Anonymous'
}

// Get sender avatar with proper fallback
const getSenderAvatar = (zap) => {
  // Prioritize fetched profile picture
  if (zap.sender?.picture) {
    return zap.sender.picture
  }
  
  // Fallback to avatar property (backward compatibility)
  if (zap.sender?.avatar) {
    return zap.sender.avatar
  }
  
  // Generate fallback avatar based on pubkey
  return generateAvatar(zap.zapperPubkey)
}

// Copy to clipboard
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Open share modal
const openShareModal = () => {
  showShareModal.value = true
}

// Open user profile modal
const openUserProfile = () => {
  if (!campaignAuthor.value) return
  
  showUserModal.value = true
}

// Initialize on mount
onMounted(async () => {
  await loadCampaign()
})
</script>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Gradient border effect for major supporters */
.border-gradient-to-r {
  border: 4px solid;
  border-image: linear-gradient(45deg, #fbbf24, #f97316) 1;
}

/* Smooth hover effects */
.transform {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
/* Compact supporter grid responsive adjustments */
@media (max-width: 640px) {
  .grid-cols-4 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 641px) and (max-width: 768px) {
  .sm\:grid-cols-6 {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

/* Enhanced hover states for supporters */
.group:hover .transform {
  transform: scale(1.1);
}

/* Improved text truncation for supporter names */
.max-w-full {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Compact spacing utilities */
.space-y-6 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1.5rem;
}

.space-y-4 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1rem;
}

.space-y-3 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 0.75rem;
}

/* Mobile-first responsive typography */
@media (max-width: 640px) {
  .text-xl {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }
  
  .text-2xl {
    font-size: 1.25rem;
    line-height: 1.75rem;
  }
  
  .text-3xl {
    font-size: 1.5rem;
    line-height: 2rem;
  }
}
