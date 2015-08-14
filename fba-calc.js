// Calculate FBA fees

/*
Accurate rounding per: 
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
*/

(function() {
  /**
   * Decimal adjustment of a number.
   *
   * @param {String}  type  The type of adjustment.
   * @param {Number}  value The number.
   * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
   * @returns {Number} The adjusted value.
   */
  function decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

  // Decimal round
  if (!Math.round10) {
    Math.round10 = function(value, exp) {
      return decimalAdjust('round', value, exp);
    };
  }
  // Decimal floor
  if (!Math.floor10) {
    Math.floor10 = function(value, exp) {
      return decimalAdjust('floor', value, exp);
    };
  }
  // Decimal ceil
  if (!Math.ceil10) {
    Math.ceil10 = function(value, exp) {
      return decimalAdjust('ceil', value, exp);
    };
  }
})();

// Function to find Median
function median(values) {
  // Find the median in array of values
    values.sort( function(a,b) {return a - b;} );

    var half = Math.floor(values.length/2);

    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
}

// Start FBA Calculations
var COST_PER_LB = 0.40;

var PICK_PACK = {
  "Standard": 1.04,
  "SML_OVER": 4.05,
  "MED_OVER": 5.12,
  "LRG_OVER": 8.21,
  "SPL_OVER": 10.34
};

function get30Day(standard_oversize, cubic_foot) {
  // Calculates the 30 day fee
   if (standard_oversize === "Standard") {
      return 0.5525 * cubic_foot;
   }
  return 0.4325 * cubic_foot;
}

function getStandardOrOversize(length, width, height, weight) {
  // Determine if object is standard size or oversized
  if (weight > 20 || Math.max(length, width, height) > 18 || Math.min(length, width, height) > 8 || median([length, width, height]) > 14) {
    return "Oversize";
  }
  return "Standard";
}

function getDimensionalWeight(length, width, height) {
  return Math.round10((height * length * width) / 166.0, -2);
}

function getGirthAndLength(length, width, height) {
  var gl = Math.max(length, width, height) + (median([length, width, height]) * 2) + (Math.min(length, width, height) * 2);
  return Math.round10(gl, -1);
}

function getCubicFoot(length, width, height) {
  return (length * width * height) / 1728.0;
}

function getWeightHandling(sizeTier, outbound, isMedia) {
  // Find the correct weight handling cost
  if (sizeTier === "SML_STND") {
    return 0.5;
  }
  
  // Large Standard
  if (sizeTier === "LRG_STND") {
    if (outbound <=1 ) {
      return 0.63;
    }
    if (isMedia) {
      if (outbound <= 2) {
        return 0.88;
      } else {
        return 0.88 + (Math.ceil(outbound) - 2) * 0.41;
      }
    } else {
      if (outbound <= 2) {
        return 1.59;
      } else {
        return 1.59 + (Math.ceil(outbound) - 2) * 0.39;
      }
    }
  }
  
  // SPL OVER
  if (sizeTier === "SPL_OVER") {
    if (outbound <= 90) {
      return 124.58;
    } else {
      return 124.58 + (Math.ceil(outbound) - 90) * 0.92;
    }
  }
  
  // Large Oversize
  if (sizeTier === "LRG_OVER") {
    if (outbound <= 90) {
      return 63.09;
    } else {
      return 63.09 + (Math.ceil(outbound) - 90) * 0.92;
    }
  }
  
  if (sizeTier === "MED_OVER") {
    if (outbound <= 2) {
      return 2.23;
    } else {
      return 2.23 + (Math.ceil(outbound) - 2) * 0.39;
    }
  }
  
  if (outbound <= 2) {
    return 1.59;
  }
  return 1.59 + (Math.ceil(outbound) - 2) * 0.39;
  
}

function calculateFees(length, width, height, weight, isApparel, isMedia, isPro) {
  // Calculate the FBA fees for the given variables
  var feeWeight;
  var sizeTier;
  var outbound;
  var orderHandling;
  var pickPack;
  var weightHandling;
  var thirtyDay;
  
  var dimensionalWeight = getDimensionalWeight(length, width, height);
  var girthLength = getGirthAndLength(length, width, height);
  var standardOversize = getStandardOrOversize(length, width, height, weight);
  var cubicFoot = getCubicFoot(length, width, height);
  

  
  if (standardOversize === "Standard") {
    if (isMedia) {
      feeWeight = 14 / 16;
    } else {
      feeWeight = 12 / 16;
    }
    
    if (feeWeight >= weight && Math.max(length, width, height) <= 15 && Math.min(length, width, height) <= 0.75 && median([length, width, height]) <= 12) {
      sizeTier = "SML_STND";
    } else {
      sizeTier = "LRG_STND";
    }
  } else {
    if (girthLength > 165 || Math.max(length, width, height) > 60 || median([length, width, height]) > 30){
      sizeTier = "MED_OVER";
    } else {
      sizeTier = "SML_OVER";
    }
  }
  
  if (isMedia) {
    outbound = weight + 0.125;
  } else {
    if (standardOversize === "Standard") {
      if (weight <= 1) {
        outbound = weight + 0.25;
      } else {
        outbound = Math.max(weight, dimensionalWeight) + 0.25;
      }
    } else if (sizeTier === "SPL_OVER") {
      outbound = weight + 1;
    } else {
      outbound = Math.max(weight, dimensionalWeight) + 1;
    }
  }
  
  if (isMedia || standardOversize === "Oversize") {
    orderHandling = 0;
  } else {
    orderHandling = 1;
  }
  
  if (standardOversize === "Standard") {
    pickPack = PICK_PACK["Standard"];
  } else {
    pickPack = PICK_PACK[sizeTier];
  }
  
  weightHandling = Math.round10(getWeightHandling(sizeTier, outbound, isMedia), -2);
  thirtyDay = get30Day(standardOversize, cubicFoot);
  
  var costs = pickPack + weightHandling + thirtyDay + orderHandling;
  
  if (isApparel) {
    costs += 0.40;
  }
  
  if (!isPro) {
    costs += 1.0;
  }
  var costPerLB = COST_PER_LB * weight;
  costs += costPerLB;
  
  return Math.round10(costs, -2);
}
