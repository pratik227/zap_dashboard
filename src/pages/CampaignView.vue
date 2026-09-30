<template>
  <div class="min-h-screen bg-gradient-to-b from-orange-25 via-amber-25/50 to-white">
    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- LOADING SKELETON — warm, pulsing, storytelling layout  -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div v-if="isLoading && !campaign" class="relative min-h-screen animate-fadeIn">
      <!-- Hero Skeleton -->
      <div class="relative w-full">
        <div class="w-full aspect-[2/1] sm:aspect-[2.8/1] max-h-[420px] bg-gradient-to-br from-orange-100/80 via-amber-50/60 to-orange-50/40 skeleton-shimmer"></div>
        <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-orange-25 via-orange-25/80 to-transparent"></div>
      </div>

      <!-- Content Skeleton -->
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <!-- Left Column -->
          <div class="lg:col-span-3 space-y-6">
            <!-- Title + Author -->
            <div class="space-y-4">
              <div class="h-9 w-4/5 bg-orange-100/60 rounded-xl skeleton-shimmer"></div>
              <div class="h-5 w-3/5 bg-orange-50/80 rounded-lg skeleton-shimmer"></div>
              <div class="flex items-center space-x-3 pt-2">
                <div class="w-11 h-11 rounded-full bg-orange-100/60 skeleton-shimmer"></div>
                <div class="space-y-1.5">
                  <div class="h-4 w-28 bg-orange-100/50 rounded skeleton-shimmer"></div>
                  <div class="h-3 w-20 bg-orange-50/60 rounded skeleton-shimmer"></div>
                </div>
              </div>
            </div>

            <!-- Progress Card Skeleton -->
            <div class="bg-white/80 rounded-2xl border border-orange-100/40 p-6 space-y-4">
              <div class="flex items-end justify-between">
                <div class="space-y-2">
                  <div class="h-8 w-36 bg-orange-100/60 rounded-lg skeleton-shimmer"></div>
                  <div class="h-4 w-48 bg-orange-50/80 rounded skeleton-shimmer"></div>
                </div>
                <div class="h-14 w-14 rounded-full bg-orange-100/40 skeleton-shimmer"></div>
              </div>
              <div class="w-full bg-orange-100/30 rounded-full h-3"></div>
              <div class="grid grid-cols-3 gap-4">
                <div v-for="n in 3" :key="n" class="space-y-1.5">
                  <div class="h-3 w-14 bg-orange-50/60 rounded skeleton-shimmer"></div>
                  <div class="h-5 w-10 bg-orange-100/50 rounded skeleton-shimmer"></div>
                </div>
              </div>
            </div>

            <!-- Description Skeleton -->
            <div class="bg-white/80 rounded-2xl border border-orange-100/40 p-6 space-y-3">
              <div class="h-5 w-20 bg-orange-100/50 rounded skeleton-shimmer"></div>
              <div class="space-y-2.5">
                <div class="h-4 w-full bg-orange-50/60 rounded skeleton-shimmer"></div>
                <div class="h-4 w-full bg-orange-50/50 rounded skeleton-shimmer"></div>
                <div class="h-4 w-3/4 bg-orange-50/40 rounded skeleton-shimmer"></div>
              </div>
            </div>

            <!-- Supporters Skeleton -->
            <div class="bg-white/80 rounded-2xl border border-orange-100/40 p-6 space-y-4">
              <div class="h-5 w-32 bg-orange-100/50 rounded skeleton-shimmer"></div>
              <div class="space-y-3">
                <div v-for="n in 3" :key="n" class="flex items-center justify-between py-2">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-orange-100/50 skeleton-shimmer"></div>
                    <div class="space-y-1.5">
                      <div class="h-4 w-24 bg-orange-100/40 rounded skeleton-shimmer"></div>
                      <div class="h-3 w-16 bg-orange-50/50 rounded skeleton-shimmer"></div>
                    </div>
                  </div>
                  <div class="h-4 w-14 bg-amber-100/50 rounded-full skeleton-shimmer"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Payment Skeleton -->
          <div class="hidden lg:block lg:col-span-2">
            <div class="sticky top-6">
              <div class="bg-white/80 rounded-2xl border border-orange-100/40 p-6 space-y-5">
                <div class="space-y-2">
                  <div class="h-6 w-48 bg-orange-100/50 rounded-lg skeleton-shimmer"></div>
                  <div class="h-4 w-56 bg-orange-50/60 rounded skeleton-shimmer"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div v-for="n in 4" :key="n" class="h-[72px] bg-orange-50/40 rounded-xl skeleton-shimmer"></div>
                </div>
                <div class="h-12 w-full bg-orange-100/50 rounded-xl skeleton-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile FAB Skeleton -->
      <div class="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none z-40">
        <div class="h-14 w-full bg-orange-100/60 rounded-2xl skeleton-shimmer"></div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- ERROR STATE                                 -->
    <!-- ═══════════════════════════════════════════ -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white/90 backdrop-blur-sm border border-red-200/60 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <IconAlertCircle class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h3>
        <p class="text-sm text-gray-500 mb-6 leading-relaxed">{{ error }}</p>
        <button
          @click="changePage('campaigns')"
          class="inline-flex items-center space-x-2 px-5 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-sm font-medium transition-all duration-200"
        >
          <IconArrowLeft class="w-4 h-4" />
          <span>Back to campaigns</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MAIN CAMPAIGN CONTENT                                   -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div v-else-if="campaign" class="relative min-h-screen">

      <!-- ─── IMMERSIVE HERO ─── -->
      <div class="relative w-full">
        <div class="relative w-full aspect-[2/1] sm:aspect-[2.8/1] max-h-[420px] overflow-hidden">
          <img
            v-if="campaign.image && !heroImageFailed"
            :src="campaign.image"
            :alt="campaign.title"
            class="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-[1.02]"
            @error="heroImageFailed = true"
          />
          <div
            v-else
            class="w-full h-full bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 flex items-center justify-center"
          >
            <div class="text-center space-y-3 opacity-50">
              <img src="/new_logo3.png" alt="ZapTracker" class="w-14 h-14 mx-auto object-contain" />
              <span class="text-sm font-medium text-orange-400 tracking-wide">ZapTracker Campaign</span>
            </div>
          </div>

          <!-- Cinematic gradient fade -->
          <div class="absolute inset-0 bg-gradient-to-t from-orange-25 via-orange-25/40 to-transparent pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-orange-25 to-transparent pointer-events-none"></div>

          <!-- Floating navigation -->
          <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-5">
            <button
              @click="changePage('campaigns')"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/50 transition-all duration-200 active:scale-95"
              aria-label="Back to campaigns"
            >
              <IconArrowLeft class="w-5 h-5" />
            </button>
            <button
              @click="openShareModal"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/50 transition-all duration-200 active:scale-95"
              aria-label="Share campaign"
            >
              <IconShare class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- ─── CONTENT AREA ─── -->
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-16 relative z-10">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">

          <!-- ════════════════════════════════════════ -->
          <!-- LEFT COLUMN: Campaign Story + Progress   -->
          <!-- ════════════════════════════════════════ -->
          <div class="lg:col-span-3 space-y-5 pb-28 lg:pb-8">

            <!-- ─── Campaign Header: Title, Status, Author ─── -->
            <div class="space-y-4">
              <!-- Title Row -->
              <div class="flex items-start gap-3">
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight flex-1 tracking-tight">
                  {{ campaign.title }}
                </h1>
                <span :class="[
                  'mt-1 px-3 py-1 rounded-full text-xs font-semibold tracking-wide flex-shrink-0 uppercase',
                  statusColor
                ]">
                  {{ status }}
                </span>
              </div>

              <!-- Summary — the story hook -->
              <p class="text-base sm:text-[17px] text-gray-600 leading-relaxed">
                {{ campaign.summary }}
              </p>

              <!-- Author chip -->
              <div class="flex items-center justify-between flex-wrap gap-3">
                <div
                  v-if="campaignAuthor"
                  @click="openUserProfile"
                  class="inline-flex items-center space-x-2.5 px-3 py-2 bg-white/80 backdrop-blur-sm border border-orange-100/50 rounded-full cursor-pointer hover:border-orange-200 hover:bg-white transition-all duration-200 group"
                >
                  <img
                    :src="campaignAuthor.picture"
                    :alt="campaignAuthor.name"
                    class="w-8 h-8 rounded-full object-cover ring-2 ring-orange-100 group-hover:ring-orange-200 transition-all"
                    @error="$event.target.src = generateAvatar(campaignAuthor.pubkey)"
                  />
                  <div class="pr-1">
                    <p class="text-sm font-semibold text-gray-900 leading-tight">{{ campaignAuthor.name }}</p>
                    <p class="text-[11px] text-gray-400 leading-tight">Campaign creator</p>
                  </div>
                </div>
                <a
                  v-if="campaign.id"
                  :href="nostrEventUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center space-x-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <IconExternalLink class="w-3.5 h-3.5" />
                  <span>View on Nostr</span>
                </a>
              </div>
            </div>

            <!-- ─── Progress Celebration Card ─── -->
            <div class="bg-white/90 backdrop-blur-sm rounded-2xl border border-orange-100/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              <div class="p-5 sm:p-6">
                <!-- Top row: amount + percentage ring -->
                <div class="flex items-end justify-between mb-5">
                  <div>
                    <div class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                      {{ formatCurrency(progress.current) }}
                    </div>
                    <div class="text-sm text-gray-500 mt-1">
                      raised of <span class="font-medium text-gray-700">{{ formatCurrency(progress.goal) }}</span> goal
                    </div>
                  </div>
                  <!-- Percentage circle -->
                  <div class="relative w-16 h-16 flex-shrink-0">
                    <svg class="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke-width="5" class="stroke-orange-100/60" />
                      <circle
                        cx="32" cy="32" r="28" fill="none" stroke-width="5"
                        class="stroke-orange-500 transition-all duration-1000 ease-out"
                        stroke-linecap="round"
                        :stroke-dasharray="`${Math.min(progress.percentage, 100) * 1.759} 175.9`"
                      />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span class="text-sm font-bold text-gray-900">{{ progress.percentage }}%</span>
                    </div>
                  </div>
                </div>

                <!-- Progress bar — warm gradient -->
                <div class="relative w-full bg-orange-100/40 rounded-full h-3 overflow-hidden mb-5">
                  <div
                    class="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 rounded-full transition-all duration-1000 ease-out"
                    :style="{ width: `${Math.min(progress.percentage, 100)}%` }"
                  ></div>
                  <!-- Shimmer on active campaigns -->
                  <div
                    v-if="status === 'active' && progress.percentage > 0 && progress.percentage < 100"
                    class="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                    :style="{ width: `${Math.min(progress.percentage, 100)}%` }"
                  >
                    <div class="w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-progressShimmer"></div>
                  </div>
                </div>

                <!-- Stats row -->
                <div class="flex items-center divide-x divide-orange-100/60">
                  <div class="pr-5">
                    <div class="text-xs text-gray-400 uppercase tracking-wider font-medium">Supporters</div>
                    <div class="text-lg font-bold text-gray-900 mt-0.5">{{ totalZapCount }}</div>
                  </div>
                  <div v-if="daysRemaining !== 'No deadline'" class="pl-5">
                    <div class="text-xs text-gray-400 uppercase tracking-wider font-medium">Time left</div>
                    <div class="text-lg font-bold text-gray-900 mt-0.5">{{ daysRemaining }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ─── About / Description ─── -->
            <div v-if="campaign.descriptionLong" class="bg-white/90 backdrop-blur-sm rounded-2xl border border-orange-100/50 p-5 sm:p-6 shadow-sm">
              <h3 class="text-base font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <span>About this campaign</span>
              </h3>
              <div class="text-[15px] text-gray-600 leading-[1.75] whitespace-pre-wrap">{{ campaign.descriptionLong }}</div>
            </div>

            <!-- ─── Supporters Section ─── -->
            <div class="bg-white/90 backdrop-blur-sm rounded-2xl border border-orange-100/50 p-5 sm:p-6 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-gray-900">
                  Supporters
                  <span v-if="recentZaps.length > 0" class="text-gray-400 font-normal text-sm ml-1">{{ recentZaps.length }}</span>
                </h3>
                <!-- Avatar stack preview -->
                <div v-if="recentZaps.length >= 3" class="flex -space-x-2">
                  <img
                    v-for="(zap, i) in recentZaps.slice(0, 4)"
                    :key="'stack-' + zap.id"
                    :src="getSenderAvatar(zap)"
                    :alt="getSenderName(zap)"
                    class="w-7 h-7 rounded-full object-cover border-2 border-white"
                    :style="{ zIndex: 4 - i }"
                    @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                  />
                </div>
              </div>

              <!-- Supporter list -->
              <div v-if="recentZaps.length > 0" class="space-y-1">
                <div
                  v-for="zap in displayedSupporters"
                  :key="zap.id"
                  class="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-orange-25/60 transition-colors duration-150"
                >
                  <div class="flex items-center space-x-3 min-w-0">
                    <img
                      :src="getSenderAvatar(zap)"
                      :alt="getSenderName(zap)"
                      class="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-orange-100/60"
                      @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                    />
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-gray-900 truncate">{{ getSenderName(zap) }}</div>
                      <div class="text-xs text-gray-400">{{ zap.timeAgo }}</div>
                    </div>
                  </div>
                  <div class="flex items-center space-x-1 flex-shrink-0 ml-3">
                    <IconBolt class="w-3.5 h-3.5 text-amber-500" />
                    <span class="text-sm font-bold text-amber-600">{{ formatSatsShort(zap.amount) }}</span>
                  </div>
                </div>

                <button
                  v-if="recentZaps.length > 5"
                  @click="showAllSupporters = !showAllSupporters"
                  class="w-full text-center text-sm font-semibold text-orange-500 hover:text-orange-600 pt-3 mt-1 border-t border-orange-100/40 transition-colors"
                >
                  {{ showAllSupporters ? 'Show less' : `View all ${recentZaps.length} supporters` }}
                </button>
              </div>

              <!-- Empty state — inviting, not empty -->
              <div v-else class="text-center py-10 px-4">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-100/40">
                  <IconBolt class="w-7 h-7 text-orange-400" />
                </div>
                <h4 class="text-base font-semibold text-gray-900 mb-1">Be the first supporter</h4>
                <p class="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                  Every campaign starts with one. Your support sets the momentum for others to follow.
                </p>
              </div>
            </div>

            <!-- Branding footer -->
            <div class="pt-4 pb-4 text-center">
              <a
                href="/"
                class="inline-flex items-center space-x-2 text-orange-400 hover:text-orange-500 font-medium text-xs transition-colors opacity-70 hover:opacity-100"
              >
                <img src="/new_logo3.png" alt="ZapTracker" class="w-3.5 h-3.5 object-contain" />
                <span>Powered by ZapTracker</span>
              </a>
            </div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- RIGHT COLUMN: Payment (Desktop Sticky)       -->
          <!-- ════════════════════════════════════════════ -->
          <div class="hidden lg:block lg:col-span-2">
            <div class="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto scrollbar-thin">
              <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-sm overflow-hidden">
                <div class="p-6">
                  <!-- Campaign ended / Goal reached -->
                  <div v-if="isPaymentDisabled" class="text-center py-10">
                    <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      :class="status === 'completed' ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'"
                    >
                      <IconCheck v-if="status === 'completed'" class="w-8 h-8 text-green-500" />
                      <IconAlertCircle v-else class="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 class="text-lg font-bold text-gray-900 mb-1">{{ paymentDisabledLabel }}</h4>
                    <p class="text-sm text-gray-400 leading-relaxed">This campaign is no longer accepting contributions.</p>
                  </div>

                  <!-- ─── Amount Selection (Step 1) ─── -->
                  <div v-else-if="currentStep === 'amount'" class="space-y-5">
                    <div>
                      <h3 class="text-lg font-bold text-gray-900">Support this campaign</h3>
                      <p class="text-sm text-gray-400 mt-1">Choose an amount or enter your own</p>
                    </div>

                    <!-- Amount grid -->
                    <div class="grid grid-cols-2 gap-2.5">
                      <button
                        v-for="amount in predefinedAmounts"
                        :key="amount.value"
                        @click="selectAmount(amount.value)"
                        :class="[
                          'relative p-4 rounded-xl border-2 transition-all duration-200 text-center group',
                          !isCustomAmount && zapAmount === amount.value
                            ? 'border-orange-400 bg-orange-50/80 shadow-sm'
                            : 'border-gray-100 hover:border-orange-200 bg-white hover:bg-orange-25/50'
                        ]"
                      >
                        <div class="font-bold text-lg text-gray-900 group-hover:text-orange-700 transition-colors">{{ amount.label }}</div>
                        <div class="text-xs text-gray-400 mt-0.5">{{ amount.description }}</div>
                        <!-- Selected indicator -->
                        <div
                          v-if="!isCustomAmount && zapAmount === amount.value"
                          class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center"
                        >
                          <IconCheck class="w-3 h-3 text-white" />
                        </div>
                      </button>
                    </div>

                    <!-- Custom amount toggle -->
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-gray-600">Custom amount</label>
                        <button
                          @click="toggleCustomAmount"
                          type="button"
                          :class="[
                            'relative inline-flex h-[24px] w-[44px] items-center rounded-full transition-colors duration-200 ease-out focus:outline-none flex-shrink-0',
                            isCustomAmount ? 'bg-orange-500' : 'bg-gray-200'
                          ]"
                        >
                          <span
                            :class="[
                              'inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
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
                            class="w-full px-4 py-3.5 pr-16 border-2 border-orange-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all text-base font-bold bg-white outline-none"
                          />
                          <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                            <span class="text-sm font-semibold text-gray-400">sats</span>
                          </div>
                        </div>
                        <p v-if="isAmountExceedsMax" class="text-xs text-red-500">Maximum amount is {{ MAX_ZAP_AMOUNT.toLocaleString() }} sats</p>
                      </div>
                    </div>

                    <!-- Message -->
                    <div>
                      <label class="block text-sm font-medium text-gray-600 mb-2">Add a message</label>
                      <textarea
                        v-model="zapComment"
                        rows="3"
                        placeholder="Say something nice..."
                        class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-all resize-none text-sm text-gray-700 placeholder-gray-300 outline-none"
                      ></textarea>
                    </div>

                    <!-- Continue button -->
                    <button
                      @click="generateInvoice"
                      :disabled="!canProceed || isGeneratingInvoice"
                      :class="[
                        'w-full px-6 py-3.5 rounded-xl font-bold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden',
                        isGeneratingInvoice
                          ? 'bg-orange-400 cursor-wait text-white'
                          : !canProceed
                          ? 'bg-gray-100 cursor-not-allowed text-gray-300'
                          : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
                      ]"
                    >
                      <div v-if="isGeneratingInvoice" class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                      <div class="relative z-10 flex items-center space-x-2">
                        <template v-if="isGeneratingInvoice">
                          <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Creating invoice...</span>
                        </template>
                        <template v-else>
                          <IconBolt class="w-4 h-4" />
                          <span>Continue with {{ effectiveAmount.toLocaleString() }} sats</span>
                        </template>
                      </div>
                    </button>
                  </div>

                  <!-- ─── Payment / QR (Step 2) ─── -->
                  <div v-else-if="currentStep === 'payment' && invoice" class="space-y-5">
                    <!-- Amount summary -->
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50/50 border border-orange-100 rounded-xl p-4">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-gray-500">Amount</span>
                        <span class="text-lg font-bold text-gray-900">{{ effectiveAmount.toLocaleString() }} sats</span>
                      </div>
                      <div v-if="zapComment" class="mt-2.5 pt-2.5 border-t border-orange-200/50">
                        <p class="text-sm text-gray-500 italic">"{{ zapComment }}"</p>
                      </div>
                    </div>

                    <!-- QR Code -->
                    <div class="text-center">
                      <div class="bg-white p-4 rounded-xl border border-gray-100 inline-block shadow-sm">
                        <QRCodeVue3
                          :value="`lightning:${invoice}`"
                          :size="200"
                          color="#000000"
                          background-color="#ffffff"
                          error-correction-level="M"
                        />
                      </div>
                      <p class="text-sm text-gray-400 mt-3">Scan with your Lightning wallet</p>
                    </div>

                    <!-- Copy invoice -->
                    <button
                      @click="copyToClipboard(invoice, 'invoice')"
                      class="w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600 transition-all flex items-center justify-center space-x-2"
                    >
                      <IconCopy class="w-4 h-4" />
                      <span>{{ copySuccess === 'invoice' ? 'Copied!' : 'Copy Invoice' }}</span>
                    </button>

                    <!-- Info notice -->
                    <div class="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3">
                      <p class="text-xs text-amber-700 leading-relaxed">
                        <span class="font-semibold">Good to know:</span> Your sats will reach the campaign creator, but payments made via QR code or external wallet can't be tracked in the campaign progress. Want your support to show?<span v-if="nostrEventUrl"> <a :href="nostrEventUrl" target="_blank" rel="noopener noreferrer" class="underline font-medium hover:text-amber-900">Zap the campaign on Nostr</a> instead.</span><span v-else> Zap the campaign post on Nostr instead.</span>
                      </p>
                    </div>

                    <!-- Payment buttons -->
                    <div class="space-y-2.5">
                      <button
                        v-if="isWalletConnected"
                        @click="payWithInternalNWC"
                        :disabled="isProcessingPayment"
                        :class="[
                          'w-full px-4 py-3.5 rounded-xl font-bold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden',
                          isProcessingPayment
                            ? 'bg-green-400 cursor-wait text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
                        ]"
                      >
                        <div v-if="isProcessingPayment" class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                        <div class="relative z-10 flex items-center space-x-2">
                          <template v-if="isProcessingPayment">
                            <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Processing payment...</span>
                          </template>
                          <template v-else>
                            <IconWallet class="w-4 h-4" />
                            <span>Pay with ZapTracker Wallet</span>
                          </template>
                        </div>
                      </button>

                      <button
                        @click="openExternalWallet"
                        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3.5 rounded-xl font-semibold text-[15px] transition-all duration-200 flex items-center justify-center space-x-2 active:scale-[0.98]"
                      >
                        <IconExternalLink class="w-4 h-4" />
                        <span>Open in wallet</span>
                      </button>
                    </div>

                    <!-- Back -->
                    <div class="text-center pt-2">
                      <button
                        @click="resetToAmountSelection"
                        class="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center space-x-1 mx-auto transition-colors"
                      >
                        <IconArrowLeft class="w-3.5 h-3.5" />
                        <span>Change amount</span>
                      </button>
                    </div>
                  </div>

                  <!-- ─── Success State ─── -->
                  <div v-else-if="paymentStatus === 'success'" class="text-center py-8">
                    <div class="w-18 h-18 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-green-100 w-[72px] h-[72px]">
                      <IconCheck class="w-9 h-9 text-green-500" />
                    </div>
                    <h4 class="text-xl font-bold text-gray-900 mb-2">Thank you!</h4>
                    <p class="text-sm text-gray-500 mb-5 leading-relaxed">
                      Your <span class="font-semibold text-gray-700">{{ effectiveAmount.toLocaleString() }} sats</span> contribution makes a real difference.
                    </p>
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50/50 border border-orange-100 rounded-xl p-3.5 mb-5">
                      <p class="text-orange-700 font-medium text-sm">
                        You're helping this campaign reach its goal
                      </p>
                    </div>
                    <button
                      @click="resetForm"
                      class="text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                    >
                      Support again
                    </button>
                  </div>

                  <!-- ─── Error State ─── -->
                  <div v-else-if="paymentStatus === 'error'" class="text-center py-6">
                    <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                      <IconAlertCircle class="w-8 h-8 text-red-500" />
                    </div>
                    <h4 class="text-lg font-bold text-gray-900 mb-2">Payment failed</h4>
                    <p class="text-sm text-gray-500 mb-5">{{ paymentError }}</p>
                    <button
                      @click="resetToAmountSelection"
                      class="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md active:scale-[0.98]"
                    >
                      <IconBolt class="w-4 h-4" />
                      <span>Try again</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- MOBILE: Floating Action Button                         -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div class="lg:hidden fixed bottom-0 left-0 right-0 p-4 pb-5 bg-gradient-to-t from-white via-white/98 to-transparent pointer-events-none z-40">
        <button
          @click="openMobilePayment"
          :disabled="isPaymentDisabled"
          :class="[
            'w-full px-6 py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2.5 pointer-events-auto transition-all duration-200 active:scale-[0.97]',
            isPaymentDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40'
          ]"
        >
          <IconBolt v-if="!isPaymentDisabled" class="w-5 h-5" />
          <span>{{ isPaymentDisabled ? paymentDisabledLabel : 'Support this campaign' }}</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MOBILE: Payment Bottom Sheet                            -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div
      v-if="showMobilePayment"
      class="lg:hidden fixed inset-0 z-50"
      @click.self="closeMobilePayment"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        :class="mobilePaymentAnimating ? 'opacity-100' : 'opacity-0'"
        @click="closeMobilePayment"
      ></div>

      <!-- Sheet -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] overflow-hidden flex flex-col"
        :class="mobilePaymentAnimating ? 'translate-y-0' : 'translate-y-full'"
      >
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-2">
          <div class="w-10 h-1 bg-gray-200 rounded-full"></div>
        </div>

        <!-- Header -->
        <div class="px-6 py-3 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">Support this campaign</h3>
            <button
              @click="closeMobilePayment"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <IconX class="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- Amount Selection (Step 1) -->
          <div v-if="currentStep === 'amount'" class="space-y-5">
            <div class="grid grid-cols-2 gap-2.5">
              <button
                v-for="amount in predefinedAmounts"
                :key="amount.value"
                @click="selectAmount(amount.value)"
                :class="[
                  'relative p-4 rounded-xl border-2 text-center transition-all duration-200 active:scale-95',
                  !isCustomAmount && zapAmount === amount.value
                    ? 'border-orange-400 bg-orange-50/80'
                    : 'border-gray-100 bg-white'
                ]"
              >
                <div class="font-bold text-lg text-gray-900">{{ amount.label }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ amount.description }}</div>
                <div
                  v-if="!isCustomAmount && zapAmount === amount.value"
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center"
                >
                  <IconCheck class="w-3 h-3 text-white" />
                </div>
              </button>
            </div>

            <!-- Custom amount -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-gray-600">Custom amount</label>
                <button
                  @click="toggleCustomAmount"
                  type="button"
                  :class="[
                    'relative inline-flex h-[24px] w-[44px] items-center rounded-full transition-colors duration-200 ease-out focus:outline-none flex-shrink-0',
                    isCustomAmount ? 'bg-orange-500' : 'bg-gray-200'
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
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
                    class="w-full px-4 py-3.5 pr-16 border-2 border-orange-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all text-base font-bold outline-none"
                  />
                  <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                    <span class="text-sm font-semibold text-gray-400">sats</span>
                  </div>
                </div>
                <p v-if="isAmountExceedsMax" class="text-xs text-red-500">Maximum amount is {{ MAX_ZAP_AMOUNT.toLocaleString() }} sats</p>
              </div>
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-2">Add a message</label>
              <textarea
                v-model="zapComment"
                rows="3"
                placeholder="Say something nice..."
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 transition-all resize-none text-sm outline-none"
              ></textarea>
            </div>

            <!-- Continue -->
            <button
              @click="generateInvoice"
              :disabled="!canProceed || isGeneratingInvoice"
              class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
            >
              <IconLoader v-if="isGeneratingInvoice" class="w-5 h-5 animate-spin" />
              <IconBolt v-else class="w-5 h-5" />
              <span>{{ isGeneratingInvoice ? 'Creating Invoice...' : `Support with ${effectiveAmount.toLocaleString()} sats` }}</span>
            </button>
          </div>

          <!-- Payment / QR (Step 2) -->
          <div v-else-if="currentStep === 'payment' && invoice" class="space-y-5">
            <div class="bg-gradient-to-r from-orange-50 to-amber-50/50 border border-orange-100 rounded-xl p-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-orange-700">Supporting with</span>
                <span class="text-xl font-bold text-gray-900">{{ effectiveAmount.toLocaleString() }} sats</span>
              </div>
              <div v-if="zapComment" class="mt-3 pt-3 border-t border-orange-200/50">
                <p class="text-xs text-gray-500 italic">"{{ zapComment }}"</p>
              </div>
            </div>

            <div class="text-center">
              <div class="bg-white p-5 rounded-2xl border border-gray-100 inline-block shadow-sm">
                <QRCodeVue3
                  :value="`lightning:${invoice}`"
                  :size="220"
                  color="#000000"
                  background-color="#ffffff"
                  error-correction-level="M"
                />
              </div>
              <p class="text-sm text-gray-400 mt-3">Scan with any Lightning wallet</p>
            </div>

            <button
              @click="copyToClipboard(invoice, 'invoice')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors flex items-center justify-center space-x-2"
            >
              <IconCopy class="w-4 h-4" />
              <span>{{ copySuccess === 'invoice' ? 'Copied!' : 'Copy Invoice' }}</span>
            </button>

            <!-- Info notice -->
            <div class="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3">
              <p class="text-xs text-amber-700 leading-relaxed">
                <span class="font-semibold">Good to know:</span> Your sats will reach the campaign creator, but payments made via QR code or external wallet can't be tracked in the campaign progress. Want your support to show?<span v-if="nostrEventUrl"> <a :href="nostrEventUrl" target="_blank" rel="noopener noreferrer" class="underline font-medium hover:text-amber-900">Zap the campaign on Nostr</a> instead.</span><span v-else> Zap the campaign post on Nostr instead.</span>
              </p>
            </div>

            <div class="space-y-2.5">
              <button
                v-if="isWalletConnected"
                @click="payWithInternalNWC"
                :disabled="isProcessingPayment"
                class="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
              >
                <IconLoader v-if="isProcessingPayment" class="w-5 h-5 animate-spin" />
                <IconWallet v-else class="w-5 h-5" />
                <span>{{ isProcessingPayment ? 'Processing...' : 'Pay with ZapTracker Wallet' }}</span>
              </button>

              <button
                @click="openExternalWallet"
                class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-2.5 active:scale-[0.98]"
              >
                <IconExternalLink class="w-5 h-5" />
                <span>Open in wallet</span>
              </button>
            </div>

            <div class="text-center pt-3 border-t border-gray-100">
              <button
                @click="resetToAmountSelection"
                class="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center space-x-1.5 mx-auto transition-colors"
              >
                <IconArrowLeft class="w-4 h-4" />
                <span>Change amount</span>
              </button>
            </div>
          </div>

          <!-- Success -->
          <div v-else-if="paymentStatus === 'success'" class="text-center py-8">
            <div class="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-green-100">
              <IconCheck class="w-10 h-10 text-green-500" />
            </div>
            <h4 class="text-2xl font-bold text-gray-900 mb-2">Thank you!</h4>
            <p class="text-gray-500 mb-5">Your {{ effectiveAmount.toLocaleString() }} sats contribution makes a real difference.</p>
            <div class="bg-gradient-to-r from-orange-50 to-amber-50/50 border border-orange-100 rounded-xl p-4 mb-5">
              <p class="text-orange-700 font-semibold text-sm">You're helping this campaign reach its goal</p>
            </div>
            <button
              @click="resetForm"
              class="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
            >
              Support again
            </button>
          </div>

          <!-- Error -->
          <div v-else-if="paymentStatus === 'error'" class="text-center py-6">
            <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <IconAlertCircle class="w-8 h-8 text-red-500" />
            </div>
            <h4 class="text-lg font-bold text-gray-900 mb-2">Payment failed</h4>
            <p class="text-sm text-gray-500 mb-5">{{ paymentError }}</p>
            <button
              @click="resetToAmountSelection"
              class="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold transition-all mx-auto active:scale-[0.98]"
            >
              <IconBolt class="w-5 h-5" />
              <span>Try again</span>
            </button>
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
import { formatSatsShort } from '../utils/format.js'
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
import { nostrService } from '../services/nostr/NostrService.js'
import { signerService } from '../services/nostr/SignerService.js'
import { makeZapRequest, decodeLnurl, nip19 } from '../services/nostr/nostrImports.js'
import { DEFAULT_RELAY_URLS } from '../utils/constants.js'
import { payInvoice } from '../utils/wallet/nwcClient.js'
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
    const authorEvent = await nostrService.queryOne({
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
      return 'bg-green-50 text-green-600 border border-green-100'
    case 'expired':
      return 'bg-red-50 text-red-600 border border-red-100'
    default:
      return 'bg-orange-50 text-orange-600 border border-orange-100'
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
      profileEvent = await nostrService.queryOne({
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
      relays: campaign.value.relays || DEFAULT_RELAY_URLS.slice(0, 5)
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
    if (!signerService.isConnected) {
      throw new Error('No Nostr signer available. Please install a NIP-07 extension.')
    }
    const signedZapRequest = await signerService.signEvent(zapRequest)

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
        lnurl = decodeLnurl(lud06)
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
/* Skeleton shimmer */
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

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}

/* Progress bar shimmer for active campaigns */
@keyframes progressShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.animate-progressShimmer {
  animation: progressShimmer 2.5s ease-in-out infinite;
}

/* Fade-in animation */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out;
}

/* Smooth transitions */
button, a, input, textarea, select {
  transition-property: background-color, border-color, color, box-shadow, transform, opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Custom scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 5px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.2);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.4);
}

/* Focus states */
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
  border-radius: 0.5rem;
}

/* Mobile touch targets */
@media (max-width: 640px) {
  button, input, textarea {
    font-size: 16px;
    min-height: 44px;
  }
}

/* Prevent tap highlight */
button, .cursor-pointer {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
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

/* iOS safe area */
@supports (padding: max(0px)) {
  .safe-bottom {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}

/* Image rendering */
img {
  image-rendering: -webkit-optimize-contrast;
}
</style>
