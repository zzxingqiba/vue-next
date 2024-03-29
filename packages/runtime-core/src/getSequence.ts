// const source = [2, 3, 1, 5, 6, 8, 7, 9 ,4]
// const target1 = [1, 3, 4, 6, 7, 9]
// const target2 = [9, 7, 6, 5, 3, 2]

// // 目标返回的是最长递增子序列的索引数组（此时前景判断已经quchule）
// // 1. 完美情况
// let sourceArr = [2, 3, 4, 5]
// // 循环一次 直接添加 即可得出最长递增子序列
// function getSequence(arr) {
//   let result = [0]
//   let sourceLength = arr.length
//   let resultEndIndex
//   for(let i = 0; i < sourceLength; i++){
//     let current = arr[i]
//     resultEndIndex = result[result.length - 1]
//     if( arr[i] === 0) continue     // 考虑0为新增节点 无需处理 为新增节点
//     // 当下一值为递增时  则直接放入
//     if(arr[resultEndIndex] < current){
//       result.push(i)
//     }
//   }
//   return result
// }

// 目标返回的是最长递增子序列的索引数组（此时前景判断已经quchule）
// 2. 乱序情况
// let sourceArr = [2, 3, 1, 5, 6, 8, 7, 9 ,4]
// 循环一次 直接添加 即可得出最长递增子序列
export function getSequence(arr) {
  let result = [0]; // 存放的递增序列的arr索引  初始为0 以0为基准做对比
  let sourceLength = arr.length;
  let resultEndIndex;

  const copyArr = arr.slice(); // 回溯纠错使用

  for (let i = 0; i < sourceLength; i++) {
    let current = arr[i]; // 当前值
    resultEndIndex = result[result.length - 1];
    if (current === 0) continue; // 考虑0为新增节点 无需处理 为新增节点
    // 当下一值为递增时  则直接放入
    if (arr[resultEndIndex] < current) {
      result.push(i);
      // 满足1.对于添加 来保存一下当前遍历值的相邻值是多少
      copyArr[i] = resultEndIndex;
      continue;
    }
    // 当下一值比当前值大 则二分查找 替换掉result中比当前值大的值中最小的值
    let left = 0; // 递增序列的开始一位索引初始值
    let right = result.length - 1; // 递增序列的最后一位索引初始值
    while (left < right) {
      // 结束标准: start == end    当前值current  索引i   目标值result[end]
      let middle = ((left + right) / 2) | 0; // 首次来看长度为9/2 | 0 索引为4  取值为6
      if (arr[result[middle]] < current) {
        // result[middle]取值为递增序列的中间值  我们要取到arr中所对应的位置作比较 arr[result[middle]]
        left = middle + 1;
      } else {
        right = middle;
      }
    }
    // 循环结束后 找到需要替换的result中的索引位置  此时result满足最长递增子序列的个数  但是位置是不对的
    // 例：2 3 4 1   此时result 输出结果为 1 3 4 而正确值为 2 3 4   这是因为在替换时我们要保证尽量最小原则 越小则代表有潜力是最长递增
    if (arr[result[right]] > current) {
      result[right] = i;
      // 满足2.对于替换 来保存一下替换值的前一个值是多少
      copyArr[i] = result[right - 1];
    }
  }
  // 回溯达到纠错目的 得到正确result序列
  // 要创建一个等同arr长度的数组
  // 1.对于添加 来保存一下当前遍历值的相邻值是多少
  // 2.对于替换 来保存一下替换值的前一个值是多少
  // 目的:就是保存一下前序节点的值是多少  为了后续回溯
  // 原因:
  // 例如 2 3 4 1 输出结果为 1 3 4 而正确值为 2 3 4
  // 我们通过从后向前遍历得到最终结果 因为result最后一位保存的索引必然是最大的  不能从前遍历是不确定第一位是被替换了还是没替换 因为第一位没有前序节点
  // start回溯
  let finalResultLength = result.length; // 最终result长度
  let end = result[finalResultLength - 1]; // 取到最后一位 从后向前遍历
  while (finalResultLength--) {
    // 递减
    result[finalResultLength] = end; // 纠正result为正确对应索引值
    end = copyArr[end]; // 纠错过后 将当前节点保存的前序节点赋值给下一次纠正使用  像一个链表的感觉  当前节点记录了前序节点 每一个节点始终知道他的前一节点是什么
  }
  return result; // 得到最长递增子序列
}

// console.log(getSequence(sourceArr))
