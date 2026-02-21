<template>
  <div class="min-h-screen bg-white">
    <!-- Loading Skeleton -->
    <div v-if="isLoading && !campaign" class="relative min-h-screen">
      <!-- Hero Skeleton -->
      <div class="relative w-full bg-gray-100">
        <div class="w-full aspect-[2.5/1] sm:aspect-[3/1] max-h-[360px] skeleton-shimmer"></div>
      </div>

      <!-- Skeleton Content Grid -->
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 p-4 sm:p-6 lg:p-8">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-5">
          <!-- Header Card Skeleton -->
          <div class="bg-white rounded-2xl border border-gray-200/60">
            <div class="p-5 sm:p-6">
              <!-- Title skeleton -->
              <div class="flex items-start justify-between gap-4 mb-4">
                <div class="flex-1 space-y-2">
                  <div class="h-7 w-3/4 bg-gray-200 rounded-lg skeleton-shimmer"></div>
                  <div class="h-5 w-1/2 bg-gray-100 rounded-lg skeleton-shimmer"></div>
                </div>
                <div class="h-7 w-20 bg-gray-100 rounded-full skeleton-shimmer"></div>
              </div>
              <!-- Author skeleton -->
              <div class="flex items-center space-x-2.5 mb-4">
                <div class="w-10 h-10 rounded-full bg-gray-200 skeleton-shimmer"></div>
                <div class="space-y-1.5">
                  <div class="h-4 w-28 bg-gray-200 rounded skeleton-shimmer"></div>
                  <div class="h-3 w-20 bg-gray-100 rounded skeleton-shimmer"></div>
                </div>
              </div>
              <!-- Summary skeleton -->
              <div class="space-y-2">
                <div class="h-4 w-full bg-gray-100 rounded skeleton-shimmer"></div>
                <div class="h-4 w-5/6 bg-gray-100 rounded skeleton-shimmer"></div>
                <div class="h-4 w-2/3 bg-gray-100 rounded skeleton-shimmer"></div>
              </div>
            </div>
            <!-- Progress skeleton -->
            <div class="border-t border-gray-200/60 p-5 sm:p-6">
              <div class="flex items-baseline justify-between mb-3">
                <div class="space-y-1.5">
                  <div class="h-8 w-32 bg-gray-200 rounded-lg skeleton-shimmer"></div>
                  <div class="h-4 w-40 bg-gray-100 rounded skeleton-shimmer"></div>
                </div>
                <div class="h-7 w-14 bg-gray-200 rounded-lg skeleton-shimmer"></div>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 mb-4"></div>
              <div class="grid grid-cols-3 gap-3">
                <div class="space-y-1.5">
                  <div class="h-3 w-16 bg-gray-100 rounded skeleton-shimmer"></div>
                  <div class="h-5 w-10 bg-gray-200 rounded skeleton-shimmer"></div>
                </div>
                <div class="border-l border-gray-200 pl-3 space-y-1.5">
                  <div class="h-3 w-14 bg-gray-100 rounded skeleton-shimmer"></div>
                  <div class="h-5 w-16 bg-gray-200 rounded skeleton-shimmer"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Skeleton -->
          <div class="bg-white rounded-2xl border border-gray-200/60 p-5 sm:p-6">
            <div class="h-6 w-16 bg-gray-200 rounded skeleton-shimmer mb-3"></div>
            <div class="space-y-2">
              <div class="h-4 w-full bg-gray-100 rounded skeleton-shimmer"></div>
              <div class="h-4 w-full bg-gray-100 rounded skeleton-shimmer"></div>
              <div class="h-4 w-4/5 bg-gray-100 rounded skeleton-shimmer"></div>
              <div class="h-4 w-3/4 bg-gray-100 rounded skeleton-shimmer"></div>
            </div>
          </div>

          <!-- Supporters Skeleton -->
          <div class="bg-white rounded-2xl border border-gray-200/60 p-5 sm:p-6">
            <div class="h-6 w-36 bg-gray-200 rounded skeleton-shimmer mb-4"></div>
            <div class="space-y-3">
              <div v-for="n in 3" :key="n" class="flex items-center justify-between py-2.5">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-full bg-gray-200 skeleton-shimmer"></div>
                  <div class="space-y-1.5">
                    <div class="h-4 w-24 bg-gray-200 rounded skeleton-shimmer"></div>
                    <div class="h-3 w-16 bg-gray-100 rounded skeleton-shimmer"></div>
                  </div>
                </div>
                <div class="h-4 w-12 bg-orange-100 rounded skeleton-shimmer"></div>
              </div>
            </div>
          </div>

          <!-- ZapTracker Branding -->
          <div class="mt-8 pb-8 text-center">
            <a
              href="/"
              class="inline-flex items-center space-x-2 text-orange-600 font-medium text-sm"
            >
              <img src="/new_logo3.png" alt="ZapTracker" class="w-4 h-4 object-contain" />
              <span>Powered by ZapTracker</span>
            </a>
          </div>
        </div>

        <!-- Right Column: Payment Skeleton (Desktop) -->
        <div class="hidden lg:block lg:col-span-1">
          <div class="sticky top-6">
            <div class="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6 space-y-5">
              <div class="space-y-1.5">
                <div class="h-6 w-44 bg-gray-200 rounded-lg skeleton-shimmer"></div>
                <div class="h-4 w-52 bg-gray-100 rounded skeleton-shimmer"></div>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div v-for="n in 4" :key="n" class="h-16 bg-gray-100 rounded-xl skeleton-shimmer"></div>
              </div>
              <div class="h-4 w-28 bg-gray-100 rounded skeleton-shimmer"></div>
              <div class="h-24 w-full bg-gray-100 rounded-xl skeleton-shimmer"></div>
              <div class="h-12 w-full bg-orange-100 rounded-xl skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile FAB Skeleton -->
      <div class="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none z-40">
        <div class="h-14 w-full bg-orange-100 rounded-xl skeleton-shimmer"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md w-full">
        <div class="flex items-center space-x-3">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <div>
            <h3 class="text-base font-semibold text-red-900">Campaign Not Found</h3>
            <p class="text-sm text-red-600 mt-1">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Campaign Content -->
    <div v-else-if="campaign" class="relative min-h-screen">
      <!-- Hero Image Section -->
      <div class="relative w-full bg-gray-100">
        <div class="relative w-full aspect-[2.5/1] sm:aspect-[3/1] max-h-[360px] overflow-hidden">
          <img
            v-if="campaign.image && !heroImageFailed"
            :src="campaign.image"
            :alt="campaign.title"
            class="w-full h-full object-cover object-center"
            @error="heroImageFailed = true"
          />
          <div
            v-else
            class="w-full h-full bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex items-center justify-center"
          >
            <div class="text-center opacity-60">
              <img
                src="/new_logo3.png"
                alt="ZapTracker"
                class="w-12 h-12 mx-auto mb-2 object-contain"
              />
              <span class="text-sm font-medium text-orange-400">ZapTracker Campaign</span>
            </div>
          </div>
          <!-- Bottom fade for seamless transition to content -->
          <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
          <!-- Floating nav overlay -->
          <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
            <button
              @click="changePage('campaigns')"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <IconArrowLeft class="w-5 h-5" />
            </button>
            <button
              @click="openShareModal"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <IconShare class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 p-4 sm:p-6 lg:p-8">
        <!-- Left Column: Campaign Details -->
        <div class="lg:col-span-2 space-y-5 pb-24 lg:pb-0">
          <!-- Campaign Header Card -->
          <div class="bg-white rounded-2xl border border-gray-200/60">
            <div class="p-5 sm:p-6">
              <!-- Title & Status -->
              <div class="flex items-start justify-between gap-4 mb-4">
                <h1 class="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight flex-1">{{ campaign.title }}</h1>
                <span :class="[
                  'px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0',
                  statusColor
                ]">
                  {{ status.charAt(0).toUpperCase() + status.slice(1) }}
                </span>
              </div>

              <!-- Author Info -->
              <div v-if="campaignAuthor" @click="openUserProfile" class="flex items-center space-x-2.5 mb-4 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors -mx-2 px-2 py-1">
                <img
                  :src="campaignAuthor.picture"
                  :alt="campaignAuthor.name"
                  class="w-10 h-10 rounded-full object-cover"
                  @error="$event.target.src = generateAvatar(campaignAuthor.pubkey)"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ campaignAuthor.name }}</p>
                  <p class="text-xs text-gray-500">Campaign creator</p>
                </div>
              </div>

              <!-- Summary -->
              <div class="text-[15px] text-gray-700 leading-relaxed">
                <p>{{ campaign.summary }}</p>
              </div>

              <!-- View on Nostr -->
              <a
                v-if="campaign.id"
                :href="nostrEventUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center space-x-1.5 text-xs text-gray-400 hover:text-orange-600 mt-3 transition-colors"
              >
                <IconExternalLink class="w-3.5 h-3.5" />
                <span>View on Nostr</span>
              </a>
            </div>

            <!-- Campaign Progress Section -->
            <div class="border-t border-gray-200/60 p-5 sm:p-6">
              <!-- Progress Stats -->
              <div class="flex items-baseline justify-between mb-3">
                <div>
                  <div class="text-2xl sm:text-3xl font-semibold text-gray-900">{{ formatCurrency(progress.current) }}</div>
                  <div class="text-sm text-gray-500 mt-0.5">raised of {{ formatCurrency(progress.goal) }} goal</div>
                </div>
                <div class="text-right">
                  <div class="text-xl font-semibold text-gray-900">{{ progress.percentage }}%</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="relative w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  class="absolute inset-y-0 left-0 bg-orange-500 rounded-full transition-all duration-1000 ease-out"
                  :style="{ width: `${Math.min(progress.percentage, 100)}%` }"
                ></div>
              </div>

              <!-- Stats Grid -->
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <div class="text-sm text-gray-500">Contributors</div>
                  <div class="text-base font-semibold text-gray-900 mt-0.5">{{ totalZapCount }}</div>
                </div>
                <div v-if="daysRemaining !== 'No deadline'" class="border-l border-gray-200 pl-3">
                  <div class="text-sm text-gray-500">Time left</div>
                  <div class="text-base font-semibold text-gray-900 mt-0.5">{{ daysRemaining }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Section -->
          <div v-if="campaign.descriptionLong" class="bg-white rounded-2xl border border-gray-200/60 p-5 sm:p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">About</h3>
            <div class="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{{ campaign.descriptionLong }}</div>
          </div>

          <!-- Supporters Section -->
          <div class="bg-white rounded-2xl border border-gray-200/60 p-5 sm:p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent supporters{{ recentZaps.length > 0 ? ` (${recentZaps.length})` : '' }}</h3>
            <div v-if="recentZaps.length > 0" class="space-y-2.5">
              <div
                v-for="zap in displayedSupporters"
                :key="zap.id"
                class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
              >
                <div class="flex items-center space-x-3">
                  <img
                    :src="getSenderAvatar(zap)"
                    :alt="getSenderName(zap)"
                    class="w-10 h-10 rounded-full object-cover"
                    @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                  />
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ getSenderName(zap) }}</div>
                    <div class="text-xs text-gray-500">{{ zap.timeAgo }}</div>
                  </div>
                </div>
                <div class="text-sm font-semibold text-orange-600">{{ formatZapAmount(zap.amount) }}</div>
              </div>
              <button
                v-if="recentZaps.length > 5"
                @click="showAllSupporters = !showAllSupporters"
                class="w-full text-center text-sm font-medium text-orange-600 hover:text-orange-700 pt-3 transition-colors"
              >
                {{ showAllSupporters ? 'Show less' : `Show all ${recentZaps.length} supporters` }}
              </button>
            </div>
            <div v-else class="text-center py-8">
              <div class="text-sm text-gray-500">No supporters yet</div>
              <div class="text-xs text-gray-400 mt-1">Be the first to support this campaign</div>
            </div>
          </div>

          <!-- ZapTracker Branding -->
          <div class="mt-8 pb-8 text-center">
            <a
              href="/"
              class="inline-flex items-center space-x-2 text-orange-600 hover:text-orange-700 font-medium text-sm transition-colors"
            >
              <img
                src="/new_logo3.png"
                alt="ZapTracker"
                class="w-4 h-4 object-contain"
              />
              <span>Powered by ZapTracker</span>
            </a>
          </div>
        </div>

        <!-- Right Column: Payment Section (Desktop) -->
        <div class="hidden lg:block lg:col-span-1">
          <div class="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            <!-- Payment Card - Apple/Twitter Aesthetic -->
            <div class="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <!-- Payment Content -->
              <div class="p-6">
                <!-- Campaign ended / Goal reached -->
                <div v-if="isPaymentDisabled" class="text-center py-8">
                  <div class="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <IconCheck v-if="status === 'completed'" class="w-7 h-7 text-green-600" />
                    <IconAlertCircle v-else class="w-7 h-7 text-gray-400" />
                  </div>
                  <h4 class="text-lg font-semibold text-gray-900 mb-1">{{ paymentDisabledLabel }}</h4>
                  <p class="text-sm text-gray-500">This campaign is no longer accepting contributions.</p>
                </div>

                <!-- Amount Selection (Step 1) -->
                <div v-else-if="currentStep === 'amount'" class="space-y-6">
                  <!-- Header -->
                  <div>
                    <h3 class="text-xl font-semibold text-gray-900">Support this campaign</h3>
                    <p class="text-sm text-gray-500 mt-1">Choose an amount or enter your own</p>
                  </div>

                  <!-- Quick Amount Selection -->
                  <div>
                    <div class="grid grid-cols-2 gap-2.5">
                      <button
                        v-for="amount in predefinedAmounts"
                        :key="amount.value"
                        @click="selectAmount(amount.value)"
                        :class="[
                          'p-3.5 rounded-xl border transition-all duration-200 text-center',
                          !isCustomAmount && zapAmount === amount.value
                            ? 'border-orange-500 bg-orange-50 text-orange-900'
                            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-900'
                        ]"
                      >
                        <div class="font-semibold text-base">{{ amount.label }}</div>
                        <div class="text-xs text-gray-500 mt-0.5">{{ amount.description }}</div>
                      </button>
                    </div>
                  </div>

                  <!-- Custom Amount with Apple-style Slider -->
                  <div class="space-y-3">
                    <!-- Toggle Section -->
                    <div class="flex items-center justify-between py-0.5">
                      <label class="text-sm font-medium text-gray-700">Custom amount</label>
                      <button
                        @click="toggleCustomAmount"
                        type="button"
                        :class="[
                          'relative inline-flex h-[24px] w-[44px] items-center rounded-full transition-colors duration-200 ease-out focus:outline-none shrink-0',
                          isCustomAmount ? 'bg-orange-500' : 'bg-gray-200'
                        ]"
                      >
                        <span
                          :class="[
                            'inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform duration-200 ease-out',
                            isCustomAmount ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          ]"
                        />
                      </button>
                    </div>

                    <!-- Custom Amount Input with Slider Effect -->
                    <div v-if="isCustomAmount" class="space-y-2">
                      <div class="relative">
                        <input
                          ref="customAmountInput"
                          v-model.number="customAmount"
                          type="number"
                          min="1"
                          :max="MAX_ZAP_AMOUNT"
                          placeholder="Enter amount"
                          class="w-full px-4 py-3.5 pr-16 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-base font-semibold bg-white"
                        />
                        <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                          <span class="text-sm font-semibold text-gray-500">sats</span>
                        </div>
                      </div>
                      <p v-if="isAmountExceedsMax" class="text-xs text-red-500">Maximum amount is {{ MAX_ZAP_AMOUNT.toLocaleString() }} sats</p>
                    </div>
                  </div>

                  <!-- Message -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
                    <textarea
                      v-model="zapComment"
                      rows="3"
                      placeholder="Add a message..."
                      class="w-full px-3.5 py-3 border border-gray-300 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none text-sm text-gray-900 placeholder-gray-400"
                    ></textarea>
                  </div>

                  <!-- Continue Button with Elegant Loading -->
                  <button
                    @click="generateInvoice"
                    :disabled="!canProceed || isGeneratingInvoice"
                    :class="[
                      'w-full px-6 py-3.5 rounded-xl font-semibold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden',
                      isGeneratingInvoice
                        ? 'bg-orange-400 cursor-not-allowed text-white'
                        : !canProceed
                        ? 'bg-gray-200 cursor-not-allowed text-gray-400'
                        : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white cursor-pointer'
                    ]"
                  >
                    <!-- Loading Animation Overlay -->
                    <div
                      v-if="isGeneratingInvoice"
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                      style="animation: shimmer 1.5s infinite;"
                    ></div>

                    <!-- Button Content -->
                    <div class="relative z-10 flex items-center space-x-2">
                      <div v-if="isGeneratingInvoice" class="flex items-center space-x-2">
                        <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating invoice...</span>
                      </div>
                      <div v-else class="flex items-center space-x-2">
                        <span>Continue with {{ effectiveAmount.toLocaleString() }} sats</span>
                      </div>
                    </div>
                  </button>
                </div>

                <!-- Payment Options (Step 2) -->
                <div v-else-if="currentStep === 'payment' && invoice" class="space-y-5">
                  <!-- Amount Summary -->
                  <div class="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-gray-700">Amount</span>
                      <span class="text-lg font-semibold text-gray-900">{{ effectiveAmount.toLocaleString() }} sats</span>
                    </div>
                    <div v-if="zapComment" class="mt-2.5 pt-2.5 border-t border-orange-200">
                      <p class="text-sm text-gray-600">"{{ zapComment }}"</p>
                    </div>
                  </div>

                  <!-- QR Code -->
                  <div class="text-center">
                    <div class="bg-white p-4 rounded-xl border border-gray-200 inline-block">
                      <QRCodeVue3
                        :value="`lightning:${invoice}`"
                        :size="200"
                        color="#000000"
                        background-color="#ffffff"
                        error-correction-level="M"
                      />
                    </div>
                    <p class="text-sm text-gray-500 mt-3">Scan with your Lightning wallet</p>
                  </div>

                  <!-- Copy Invoice -->
                  <button
                    @click="copyToClipboard(invoice, 'invoice')"
                    class="w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <IconCopy class="w-4 h-4" />
                    <span>{{ copySuccess === 'invoice' ? 'Copied!' : 'Copy Invoice' }}</span>
                  </button>

                  <!-- QR / External wallet info notice -->
                  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p class="text-xs text-amber-800 leading-relaxed">
                      <span class="font-semibold">Good to know:</span> Your sats will reach the campaign creator, but payments made via QR code or external wallet can't be tracked in the campaign progress. Want your support to show?<span v-if="nostrEventUrl"> <a :href="nostrEventUrl" target="_blank" rel="noopener noreferrer" class="underline font-medium hover:text-amber-900">Zap the campaign on Nostr</a> instead.</span><span v-else> Zap the campaign post on Nostr instead.</span>
                    </p>
                  </div>

                  <!-- Payment Buttons -->
                  <div class="space-y-2.5">
                    <!-- Pay with ZapTracker Wallet -->
                    <button
                      v-if="isWalletConnected"
                      @click="payWithInternalNWC"
                      :disabled="isProcessingPayment"
                      :class="[
                        'w-full px-4 py-3.5 rounded-xl font-semibold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden',
                        isProcessingPayment
                          ? 'bg-green-400 cursor-not-allowed text-white'
                          : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white cursor-pointer'
                      ]"
                    >
                      <!-- Loading Animation Overlay -->
                      <div
                        v-if="isProcessingPayment"
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        style="animation: shimmer 1.5s infinite;"
                      ></div>

                      <!-- Button Content -->
                      <div class="relative z-10 flex items-center space-x-2">
                        <div v-if="isProcessingPayment" class="flex items-center space-x-2">
                          <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processing payment...</span>
                        </div>
                        <div v-else class="flex items-center space-x-2">
                          <IconWallet class="w-4 h-4" />
                          <span>Pay with ZapTracker Wallet</span>
                        </div>
                      </div>
                    </button>

                    <!-- Open in External Wallet -->
                    <button
                      @click="openExternalWallet"
                      class="w-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-900 px-4 py-3.5 rounded-xl font-semibold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <IconExternalLink class="w-4 h-4" />
                      <span>Open in wallet</span>
                    </button>
                  </div>
                  
                  <!-- Back Button -->
                  <div class="text-center pt-2">
                    <button
                      @click="resetToAmountSelection"
                      class="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1 mx-auto transition-colors"
                    >
                      <IconArrowLeft class="w-4 h-4" />
                      <span>Change amount</span>
                    </button>
                  </div>
                </div>

                <!-- Success State -->
                <div v-else-if="paymentStatus === 'success'" class="text-center py-6">
                  <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconCheck class="w-8 h-8 text-green-600" />
                  </div>
                  <h4 class="text-xl font-semibold text-green-600 mb-2">Thank You!</h4>
                  <p class="text-gray-600 mb-4">Your {{ effectiveAmount.toLocaleString() }} sats contribution makes a difference!</p>
                  <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <p class="text-orange-800 font-medium text-sm">
                      Your support helps bring this campaign closer to its goal
                    </p>
                  </div>
                  <button
                    @click="resetForm"
                    class="text-orange-600 hover:text-orange-700 text-sm font-semibold transition-colors"
                  >
                    Support again
                  </button>
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

          </div>
        </div>
      </div>


      <!-- Mobile Floating Action Button -->
      <div class="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none z-40">
        <button
          @click="openMobilePayment"
          :disabled="isPaymentDisabled"
          :class="[
            'w-full px-6 py-4 rounded-xl font-semibold text-base shadow-lg flex items-center justify-center space-x-2 pointer-events-auto transition-all duration-200',
            isPaymentDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white'
          ]"
        >
          <span>{{ isPaymentDisabled ? paymentDisabledLabel : 'Support this campaign' }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile Payment Bottom Sheet -->
    <div
      v-if="showMobilePayment"
      class="lg:hidden fixed inset-0 z-50"
      @click.self="closeMobilePayment"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        :class="mobilePaymentAnimating ? 'opacity-100' : 'opacity-0'"
        @click="closeMobilePayment"
      ></div>

      <!-- Bottom Sheet -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ease-out max-h-[90vh] overflow-hidden flex flex-col"
        :class="mobilePaymentAnimating ? 'translate-y-0' : 'translate-y-full'"
      >
        <!-- Handle Bar -->
        <div class="flex justify-center pt-3 pb-3">
          <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        <!-- Header -->
        <div class="relative px-6 py-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-gray-900">Support this campaign</h3>
            <button
              @click="closeMobilePayment"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <IconX class="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- Amount Selection (Step 1) -->
          <div v-if="currentStep === 'amount'" class="space-y-5">
            <!-- Quick Amount Selection -->
            <div>
              <div class="grid grid-cols-2 gap-2.5">
                <button
                  v-for="amount in predefinedAmounts"
                  :key="amount.value"
                  @click="selectAmount(amount.value)"
                  :class="[
                    'p-3.5 rounded-xl border text-center transition-all duration-200 active:scale-95',
                    !isCustomAmount && zapAmount === amount.value
                      ? 'border-orange-500 bg-orange-50 text-orange-900'
                      : 'border-gray-200 bg-white text-gray-900'
                  ]"
                >
                  <div class="font-semibold text-base">{{ amount.label }}</div>
                  <div class="text-xs text-gray-500 mt-0.5">{{ amount.description }}</div>
                </button>
              </div>
            </div>

            <!-- Custom Amount with Slider -->
            <div class="space-y-3">
              <div class="flex items-center justify-between py-0.5">
                <label class="text-sm font-medium text-gray-700">Custom amount</label>
                <button
                  @click="toggleCustomAmount"
                  type="button"
                  :class="[
                    'relative inline-flex h-[24px] w-[44px] items-center rounded-full transition-colors duration-200 ease-out focus:outline-none shrink-0',
                    isCustomAmount ? 'bg-orange-500' : 'bg-gray-200'
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform duration-200 ease-out',
                      isCustomAmount ? 'translate-x-[22px]' : 'translate-x-[2px]'
                    ]"
                  />
                </button>
              </div>

              <div v-if="isCustomAmount" class="space-y-2">
                <div class="relative">
                  <input
                    ref="customAmountInput"
                    v-model.number="customAmount"
                    type="number"
                    min="1"
                    :max="MAX_ZAP_AMOUNT"
                    placeholder="Enter amount"
                    class="w-full px-4 py-3.5 pr-16 border border-gray-300 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-base font-semibold"
                  />
                  <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                    <span class="text-sm font-semibold text-gray-500">sats</span>
                  </div>
                </div>
                <p v-if="isAmountExceedsMax" class="text-xs text-red-500">Maximum amount is {{ MAX_ZAP_AMOUNT.toLocaleString() }} sats</p>
              </div>
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
              <textarea
                v-model="zapComment"
                rows="3"
                placeholder="Add a message..."
                class="w-full px-3.5 py-3 border border-gray-300 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none text-sm"
              ></textarea>
            </div>

            <!-- Continue Button -->
            <button
              @click="generateInvoice"
              :disabled="!canProceed || isGeneratingInvoice"
              class="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
            >
              <IconLoader v-if="isGeneratingInvoice" class="w-5 h-5 animate-spin" />
              <IconBolt v-else class="w-5 h-5" />
              <span>{{ isGeneratingInvoice ? 'Creating Invoice...' : `Support with ${effectiveAmount.toLocaleString()} sats` }}</span>
            </button>
          </div>

          <!-- Payment Options (Step 2) -->
          <div v-else-if="currentStep === 'payment' && invoice" class="space-y-5">
            <!-- Amount Summary -->
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-orange-800">Supporting with:</span>
                <span class="text-xl font-bold text-orange-600">{{ effectiveAmount.toLocaleString() }} sats</span>
              </div>
              <div v-if="zapComment" class="mt-3 pt-3 border-t border-orange-200">
                <p class="text-xs text-orange-700 italic">"{{ zapComment }}"</p>
              </div>
            </div>

            <!-- QR Code -->
            <div class="text-center">
              <div class="bg-white p-6 rounded-2xl border-2 border-gray-200 inline-block shadow-sm">
                <QRCodeVue3
                  :value="`lightning:${invoice}`"
                  :size="220"
                  color="#000000"
                  background-color="#ffffff"
                  error-correction-level="M"
                />
              </div>
              <p class="text-sm text-gray-600 mt-4">Scan with any Lightning wallet</p>
            </div>

            <!-- Copy Invoice -->
            <button
              @click="copyToClipboard(invoice, 'invoice')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors flex items-center justify-center space-x-2"
            >
              <IconCopy class="w-4 h-4" />
              <span>{{ copySuccess === 'invoice' ? 'Copied!' : 'Copy Invoice' }}</span>
            </button>

            <!-- QR / External wallet info notice -->
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p class="text-xs text-amber-800 leading-relaxed">
                <span class="font-semibold">Good to know:</span> Your sats will reach the campaign creator, but payments made via QR code or external wallet can't be tracked in the campaign progress. Want your support to show?<span v-if="nostrEventUrl"> <a :href="nostrEventUrl" target="_blank" rel="noopener noreferrer" class="underline font-medium hover:text-amber-900">Zap the campaign on Nostr</a> instead.</span><span v-else> Zap the campaign post on Nostr instead.</span>
              </p>
            </div>

            <!-- Payment Buttons -->
            <div class="space-y-3">
              <!-- Pay with ZapTracker Wallet -->
              <button
                v-if="isWalletConnected"
                @click="payWithInternalNWC"
                :disabled="isProcessingPayment"
                class="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
              >
                <IconLoader v-if="isProcessingPayment" class="w-5 h-5 animate-spin" />
                <IconWallet v-else class="w-5 h-5" />
                <span>{{ isProcessingPayment ? 'Processing...' : 'Pay with ZapTracker Wallet' }}</span>
              </button>

              <!-- Open in External Wallet -->
              <button
                @click="openExternalWallet"
                class="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-2.5 shadow-lg active:scale-[0.98]"
              >
                <IconExternalLink class="w-5 h-5" />
                <span>Open in Wallet</span>
              </button>
            </div>

            <!-- Back Button -->
            <div class="text-center pt-3 border-t border-gray-200">
              <button
                @click="resetToAmountSelection"
                class="text-gray-600 hover:text-gray-800 text-sm font-semibold flex items-center space-x-1.5 mx-auto"
              >
                <IconArrowLeft class="w-4 h-4" />
                <span>Change Amount</span>
              </button>
            </div>
          </div>

          <!-- Success State -->
          <div v-else-if="paymentStatus === 'success'" class="text-center py-8">
            <div class="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <IconCheck class="w-10 h-10 text-green-600" />
            </div>
            <h4 class="text-2xl font-bold text-green-600 mb-3">Thank You!</h4>
            <p class="text-gray-600 mb-5">Your {{ effectiveAmount.toLocaleString() }} sats contribution makes a difference!</p>
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-5">
              <p class="text-orange-800 font-semibold text-sm">
                Your support helps bring this campaign closer to its goal
              </p>
            </div>
            <button
              @click="resetForm"
              class="text-orange-600 hover:text-orange-700 font-semibold transition-colors"
            >
              Support again
            </button>
          </div>

          <!-- Error State -->
          <div v-else-if="paymentStatus === 'error'" class="space-y-4">
            <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <div class="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <IconAlertCircle class="w-8 h-8 text-red-600" />
              </div>
              <h4 class="text-lg font-bold text-red-800 mb-2">Payment Failed</h4>
              <p class="text-sm text-red-700 mb-5">{{ paymentError }}</p>
              <button
                @click="resetToAmountSelection"
                class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-2 mx-auto"
              >
                <IconBolt class="w-5 h-5" />
                <span>Try Again</span>
              </button>
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
import { ref, computed, onMounted, watch, inject, nextTick } from 'vue'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import {
  IconBolt,
  IconShare,
  IconArrowLeft,
  IconLoader,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconExternalLink,
  IconCopy,
  IconWallet
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useCampaigns } from '../composables/campaigns/useCampaigns.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useNostrConnections } from '../composables/core/useNostrConnections.js'
import { useNotifications } from '../composables/core/useNotifications.js'
import { nostrRelayManager } from '../utils/network/nostrRelayManager.js'
import { makeZapRequest } from 'nostr-tools/nip57'
import { payInvoice } from '../utils/wallet/nwcClient.js'
import { bech32 } from '@scure/base'
import * as nip19 from 'nostr-tools/nip19'
import CampaignShareModal from '../components/campaigns/CampaignShareModal.vue'
import UserProfileModal from '../components/modals/UserProfileModal.vue'

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
const heroImageFailed = ref(false)
const showShareModal = ref(false)
const showUserModal = ref(false)
const copySuccess = ref('')
const showAllSupporters = ref(false)
const showMobilePayment = ref(false)
const mobilePaymentAnimating = ref(false)

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
  
  try {
    const loadedCampaign = await fetchCampaignById(eventId)
    campaign.value = loadedCampaign
    
    // Fetch author profile
    await fetchAuthorProfile(loadedCampaign.pubkey)
  } catch (err) {
    console.error('Failed to load campaign:', err)
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
          lud16: profile.lud16 || null,
          lud06: profile.lud06 || null
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

// Nostr event URL for njump.me
const nostrEventUrl = computed(() => {
  if (!campaign.value?.id) return ''
  try {
    const nevent = nip19.neventEncode({ id: campaign.value.id })
    return `https://njump.me/${nevent}`
  } catch {
    return ''
  }
})

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

// Check if payment should be disabled
const isPaymentDisabled = computed(() => {
  return status.value === 'expired' || status.value === 'completed'
})

const paymentDisabledLabel = computed(() => {
  if (status.value === 'expired') return 'Campaign ended'
  if (status.value === 'completed') return 'Goal reached'
  return ''
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

// Get recent zaps from campaign aggregated zaps
const recentZaps = computed(() => {
  if (!campaign.value) return []
  
  // Get zaps from the campaign aggregated zaps system using the reactive Map
  const campaignZaps = campaignZapsMap.value.get(campaign.value.id) || []
  
  return campaignZaps
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by most recent first
    .map(zap => ({
      ...zap,
      timeAgo: formatTimeAgo(zap.timestamp)
    }))
})

const displayedSupporters = computed(() => {
  if (showAllSupporters.value) {
    return recentZaps.value
  }
  return recentZaps.value.slice(0, 5)
})
// Get total zap count for this campaign
const totalZapCount = computed(() => {
  if (!campaign.value) return 0
  const campaignZaps = campaignZapsMap.value.get(campaign.value.id) || []
  return campaignZaps.length
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

const MAX_ZAP_AMOUNT = 10_000_000

const isAmountExceedsMax = computed(() => {
  return effectiveAmount.value > MAX_ZAP_AMOUNT
})

const canProceed = computed(() => {
  return isValidAmount.value && !isAmountExceedsMax.value && !isGeneratingInvoice.value
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

// Reference for custom amount input
const customAmountInput = ref(null)

// Toggle custom amount
const toggleCustomAmount = () => {
  isCustomAmount.value = !isCustomAmount.value
  if (isCustomAmount.value && !customAmount.value) {
    customAmount.value = zapAmount.value
  }
  // Auto-focus the input when toggled on
  if (isCustomAmount.value) {
    nextTick(() => {
      if (customAmountInput.value) {
        customAmountInput.value.focus()
      }
    })
  }
}

// Generate Lightning invoice via NIP-57
const generateInvoice = async () => {
  if (!canProceed.value) return
  
  isGeneratingInvoice.value = true
  paymentError.value = ''
  paymentStatus.value = ''
  
  try {
    // Use cached author data to construct metadata for zap endpoint resolution
    let profileEvent
    if (campaignAuthor.value?.lud16 || campaignAuthor.value?.lud06) {
      // Build synthetic metadata event from cached profile
      profileEvent = {
        content: JSON.stringify({
          lud16: campaignAuthor.value.lud16,
          lud06: campaignAuthor.value.lud06
        })
      }
    } else {
      // Fallback: fetch from relay only if no cached lightning data
      profileEvent = await nostrRelayManager.getEvent({
        kinds: [0],
        authors: [campaignAuthor.value.pubkey],
        limit: 1
      })
      if (!profileEvent) {
        throw new Error('Could not find author profile')
      }
    }

    // Get zap endpoint using proper nostr-tools implementation
    const zapEndpoint = await getZapEndpoint(profileEvent)
    
    if (!zapEndpoint) {
      throw new Error('Author does not have a zap endpoint configured')
    }
    
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

    // NIP-57 requires the zap request to be signed before sending
    if (!window.nostr) {
      throw new Error('No Nostr signer available. Please install a NIP-07 extension.')
    }
    const signedZapRequest = await window.nostr.signEvent(zapRequest)

    // Get invoice from zap endpoint
    const zapRequestString = JSON.stringify(signedZapRequest)
    const encodedZapRequest = encodeURIComponent(zapRequestString)
    const zapEndpointUrl = `${zapEndpoint}?amount=${effectiveAmount.value * 1000}&nostr=${encodedZapRequest}`

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
    
    if (!zapEndpointResponse.pr) {
      console.error('Zap endpoint response:', zapEndpointResponse)
      throw new Error('No payment request in zap endpoint response')
    }
    
    invoice.value = zapEndpointResponse.pr
    currentStep.value = 'payment'
    
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
    const paymentResult = await payInvoice({
      invoice: invoice.value
    })
    
    paymentStatus.value = 'success'
    
    // Notify about successful payment
    handlePaymentSuccess(paymentResult)
    handleZapSent({
      amount: effectiveAmount.value,
      recipient: campaignAuthor.value.name || 'Campaign Author'
    })
    
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
    // Create lightning: URI — use location.href to avoid blank tab
    const lightningUri = `lightning:${invoice.value}`
    window.location.href = lightningUri
    
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
    
    // Fetch LNURL metadata
    const response = await fetch(lnurl)
    if (!response.ok) {
      throw new Error(`LNURL endpoint returned ${response.status}`)
    }
    
    const body = await response.json()
    
    // Check for NIP-57 zap compatibility
    if (body.allowsNostr && body.nostrPubkey) {
      return body.callback
    } else {
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

// Mobile payment sheet functions
const openMobilePayment = () => {
  if (isPaymentDisabled.value) return
  showMobilePayment.value = true
  setTimeout(() => {
    mobilePaymentAnimating.value = true
  }, 10)
}

const closeMobilePayment = () => {
  mobilePaymentAnimating.value = false
  setTimeout(() => {
    showMobilePayment.value = false
    resetToAmountSelection()
  }, 300)
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

/* Smooth transitions for common elements */
button,
a,
input,
textarea,
select {
  transition-property: background-color, border-color, color, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Shimmer loading animation */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}

/* Skeleton loading shimmer */
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%);
  animation: shimmer 1.8s ease-in-out infinite;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    font-size: 16px;
    min-height: 44px;
  }
}

/* Enhanced hover and active states */
button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
  border-radius: 0.5rem;
}

/* Smooth animations for supporter cards */
.group:hover {
  transform: scale(1.05);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Enhanced shadow utilities */
.shadow-xl {
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 10px 20px -10px rgba(0, 0, 0, 0.04);
}

.shadow-2xl {
  box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Mobile bottom sheet animation */
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Gradient text */
.bg-clip-text {
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Ring utilities for focused elements */
.ring-2 {
  box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.2);
}

/* Backdrop blur support */
@supports (backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px)) {
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .backdrop-blur-md {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
}

/* Mobile responsive spacing */
@media (max-width: 640px) {
  .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0.75rem;
  }

  .space-y-5 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1rem;
  }

  .space-y-6 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1.25rem;
  }
}

/* Tablet and desktop spacing */
@media (min-width: 1024px) {
  .lg\:space-y-6 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1.5rem;
  }
}

/* Text truncation */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Smooth image loading */
img {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

/* iOS safe area handling */
@supports (padding: max(0px)) {
  .safe-bottom {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}

/* Prevent text selection on interactive elements */
button, .cursor-pointer {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
</style>
